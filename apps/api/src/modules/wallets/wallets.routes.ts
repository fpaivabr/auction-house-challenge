import { Router } from 'express';

import { WalletHoldStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';

export const walletsRouter = Router();

walletsRouter.use(authenticate);

walletsRouter.get('/me', async (_req, res) => {
  const userId: string = res.locals.user.id;

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (!wallet) {
    throw new AppError(404, 'Carteira não encontrada.');
  }

  const holds = await prisma.walletHold.aggregate({
    where: {
      userId,
      status: WalletHoldStatus.ACTIVE,
    },
    _sum: {
      amountInCents: true,
    },
  });

  const reserved = holds._sum.amountInCents ?? 0n;
  const available = wallet.balanceInCents - reserved;

  res.status(200).json({
    wallet: {
      balanceInCents: wallet.balanceInCents.toString(),
      reservedInCents: reserved.toString(),
      availableInCents: available.toString(),
      currency: 'BRL',
    },
  });
});

walletsRouter.get('/me/transactions', async (_req, res) => {
  const userId: string = res.locals.user.id;

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!wallet) {
    throw new AppError(404, 'Carteira não encontrada.');
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: {
      walletId: wallet.id,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 50,
  });

  res.status(200).json({
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amountInCents: transaction.amountInCents.toString(),
      referenceId: transaction.referenceId,
      createdAt: transaction.createdAt,
    })),
  });
});
