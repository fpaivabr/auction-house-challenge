import { Router } from 'express';

import {
  UserRole,
  WalletHoldStatus,
  WalletTransactionType,
} from '../../generated/prisma/client.js';
import { z } from 'zod';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

export const walletsRouter = Router();

walletsRouter.use(authenticate);

const depositSchema = z
  .object({
    amountInCents: z.number().int().min(100).max(100_000_000).safe(),
  })
  .strict();

walletsRouter.post('/me/deposits', authorize(UserRole.BIDDER), async (req, res) => {
  const parsed = depositSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(400, 'Informe um depósito entre R$ 1,00 e R$ 1.000.000,00.');
  }

  const userId: string = res.locals.user.id;
  const amountInCents = BigInt(parsed.data.amountInCents);

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError(404, 'Carteira não encontrada.');
    }

    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: {
        balanceInCents: {
          increment: amountInCents,
        },
      },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ADJUSTMENT,
        amountInCents,
      },
    });

    return { updatedWallet, transaction };
  });

  res.status(201).json({
    deposit: {
      id: result.transaction.id,
      amountInCents: result.transaction.amountInCents.toString(),
      createdAt: result.transaction.createdAt,
    },
    balanceInCents: result.updatedWallet.balanceInCents.toString(),
  });
});

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
