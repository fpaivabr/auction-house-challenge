import { Router } from 'express';

import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

import { SettlementStatus, UserRole } from '../../generated/prisma/client.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

export const receiptsRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

receiptsRouter.get('/mine', authenticate, authorize(UserRole.BIDDER), async (_req, res) => {
  const userId: string = res.locals.user.id;

  const receipts = await prisma.receipt.findMany({
    where: {
      settlement: {
        is: {
          winnerId: userId,
          status: SettlementStatus.COMPLETED,
        },
      },
    },
    include: {
      lot: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
        },
      },
      settlement: {
        select: {
          amountInCents: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      issuedAt: 'desc',
    },
    take: 50,
  });

  res.status(200).json({
    receipts: receipts.map((receipt) => ({
      token: receipt.publicToken,
      lot: receipt.lot,
      amountInCents: receipt.settlement.amountInCents.toString(),
      currency: 'BRL',
      status: receipt.settlement.status,
      settledAt: receipt.settlement.createdAt,
      issuedAt: receipt.issuedAt,
    })),
  });
});

receiptsRouter.get('/:token', async (req, res) => {
  const token = String(req.params.token);

  if (!uuidPattern.test(token)) {
    throw new AppError(404, 'Recibo não encontrado.');
  }

  const receipt = await prisma.receipt.findUnique({
    where: { publicToken: token },
    include: {
      lot: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
        },
      },
      settlement: {
        select: {
          amountInCents: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!receipt) {
    throw new AppError(404, 'Recibo não encontrado.');
  }

  res.status(200).json({
    receipt: {
      token: receipt.publicToken,
      lot: receipt.lot,
      amountInCents: receipt.settlement.amountInCents.toString(),
      currency: 'BRL',
      status: receipt.settlement.status,
      settledAt: receipt.settlement.createdAt,
      issuedAt: receipt.issuedAt,
    },
  });
});
