import { Router } from 'express';

import { env } from '../../config/env.js';
import { UserRole } from '../../generated/prisma/client.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { verifyAuditCheckpoints } from './audit-checkpoint.service.js';
import { verifyAllBidAuditConsistency } from './audit.service.js';

export const auditRouter = Router();

auditRouter.get('/verify', authenticate, authorize(UserRole.AUCTIONEER), async (_req, res) => {
  const audit = await verifyAllBidAuditConsistency();

  if (!audit.valid) {
    res.status(409).json({ audit });
    return;
  }

  // Nos testes e no desenvolvimento sem armazenamento
  // configurado, a proteção externa é informada como inativa.
  const checkpointDirectory = env.NODE_ENV === 'test' ? undefined : env.AUDIT_CHECKPOINT_DIR;

  if (!checkpointDirectory) {
    res.status(env.NODE_ENV === 'production' ? 503 : 200).json({
      audit,
      checkpoint: {
        enabled: false,
        verified: false,
        error: 'Armazenamento de checkpoints não configurado.',
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
