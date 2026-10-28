import { createHmac } from 'node:crypto';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { LotStatus, UserRole } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { verifyAuditCheckpoints } from './audit-checkpoint.service.js';
import { verifyAllBidAuditConsistency, verifyBidAuditConsistency } from './audit.service.js';

export const auditRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IntegrityStatus = 'VALID' | 'INVALID' | 'PENDING' | 'UNVERIFIED';

function participantCode(lotId: string, bidderId: string) {
  return createHmac('sha256', env.AUDIT_SECRET)
    .update(`${lotId}:${bidderId}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

// Mantém a verificação administrativa existente.
auditRouter.get('/verify', authenticate, authorize(UserRole.AUCTIONEER), async (_req, res) => {
  const audit = await verifyAllBidAuditConsistency();

  if (!audit.valid) {
    res.status(409).json({ audit });
    return;
  }

  const checkpointDirectory = env.NODE_ENV === 'test' ? undefined : env.AUDIT_CHECKPOINT_DIR;

  if (!checkpointDirectory) {
    res.status(env.NODE_ENV === 'production' ? 503 : 200).json({
      audit,
      checkpoint: {
        enabled: false,
        verified: false,
        error: 'Armazenamento externo de integridade não configurado.',
      },
    });
    return;
  }

  const checkpoint = await verifyAuditCheckpoints(checkpointDirectory);

  res.status(checkpoint.valid ? 200 : 409).json({
    audit,
    checkpoint: {
      enabled: true,
      verified: checkpoint.valid,
      ...checkpoint,
    },
  });
});

// Auditoria pública, por lote, sem login.
auditRouter.get('/lots/:id', async (req, res) => {
  const lotId = String(req.params.id);

  if (!uuidPattern.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  if (
    !lot ||
    (lot.status !== LotStatus.SCHEDULED &&
      lot.status !== LotStatus.OPEN &&
      lot.status !== LotStatus.CLOSED)
  ) {
    throw new AppError(404, 'Lote não encontrado.');
  }

  const [audit, bids] = await Promise.all([
    verifyBidAuditConsistency(lotId),
    prisma.bid.findMany({
      where: { lotId },
      select: {
        id: true,
        bidderId: true,
        amountInCents: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  let status: IntegrityStatus = audit.valid ? 'UNVERIFIED' : 'INVALID';

  let message = audit.valid
    ? 'O histórico foi conferido, mas a âncora externa ainda não foi verificada.'
    : (audit.error ?? 'Foram encontradas inconsistências no histórico.');

  let checkpointSequence: string | null = null;
  let pendingEntries: string | null = null;

  const checkpointDirectory = env.NODE_ENV === 'test' ? undefined : env.AUDIT_CHECKPOINT_DIR;

  if (audit.valid && checkpointDirectory) {
    const checkpoint = await verifyAuditCheckpoints(checkpointDirectory);

    checkpointSequence = checkpoint.anchoredSequence ?? null;

    if (checkpoint.valid) {
      pendingEntries = checkpoint.pendingEntries ?? '0';

      if (pendingEntries === '0') {
        status = 'VALID';
        message = 'Histórico de lances e registro externo de integridade verificados.';
      } else {
        status = 'PENDING';
        message =
          'Histórico consistente, mas existem eventos aguardando registro externo de integridade.';
      }
    } else {
      status = checkpoint.error?.includes('não corresponde') ? 'INVALID' : 'UNVERIFIED';

      message = checkpoint.error ?? 'Não foi possível verificar o registro externo de integridade.';
    }
  }

  res.status(status === 'INVALID' ? 409 : 200).json({
    lot,
    bids: bids.map((bid, index) => ({
      position: index + 1,
      participantCode: participantCode(lotId, bid.bidderId),
      amountInCents: bid.amountInCents.toString(),
      createdAt: bid.createdAt,
    })),
    integrity: {
      status,
      checkedBids: audit.checkedBids,
      message,
      checkpointSequence,
      pendingEntries,
    },
  });
});
