import { randomUUID } from 'node:crypto';

import {
  LotStatus,
  SettlementStatus,
  WalletHoldStatus,
  WalletTransactionType,
} from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

export async function settleLot(lotId: string, now = new Date()) {
  return prisma.$transaction(
    async (tx) => {
      // Impede duas liquidações simultâneas do mesmo lote.
      const lockedLots = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Lot"
        WHERE id = ${lotId}::uuid
        FOR UPDATE
      `;

      if (lockedLots.length === 0) {
        throw new AppError(404, 'Lote não encontrado.');
      }

      const lot = await tx.lot.findUniqueOrThrow({
        where: { id: lotId },
      });

      // Retorna a liquidação existente sem cobrar novamente.
      const existingSettlement = await tx.settlement.findUnique({
        where: { lotId },
        include: { receipt: true },
      });

      if (existingSettlement) {
        return {
          settlementId: existingSettlement.id,
          receiptToken: existingSettlement.receipt?.publicToken ?? null,
          alreadySettled: true,
        };
      }

      if (
        (lot.status !== LotStatus.OPEN && lot.status !== LotStatus.SCHEDULED) ||
        !lot.endsAt ||
        lot.endsAt > now
      ) {
        throw new AppError(409, 'O lote ainda não pode ser liquidado.');
      }

      if (!lot.winningBidderId || lot.currentPriceInCents === null) {
        throw new AppError(409, 'O lote não possui lance vencedor.');
      }

      const winningHold = await tx.walletHold.findFirst({
        where: {
          lotId,
          userId: lot.winningBidderId,
          amountInCents: lot.currentPriceInCents,
          status: WalletHoldStatus.ACTIVE,
        },
      });

      if (!winningHold) {
        throw new AppError(409, 'Reserva financeira do vencedor não encontrada.');
      }

      // Mantém a mesma ordem de bloqueio usada no serviço de lances.
      const userIds = [lot.winningBidderId, lot.auctioneerId].sort();

      for (const userId of userIds) {
        const wallets = await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM "Wallet"
          WHERE "userId" = ${userId}::uuid
          FOR UPDATE
        `;

        if (wallets.length === 0) {
          throw new AppError(409, 'Carteira da liquidação não encontrada.');
        }
      }

      const winnerWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: lot.winningBidderId },
      });

      const auctioneerWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: lot.auctioneerId },
      });

      const amount = lot.currentPriceInCents;

      // Evita saldo negativo mesmo se houver dados inconsistentes.
      const debit = await tx.wallet.updateMany({
        where: {
          id: winnerWallet.id,
          balanceInCents: { gte: amount },
        },
        data: {
          balanceInCents: { decrement: amount },
        },
      });

      if (debit.count !== 1) {
        throw new AppError(409, 'Saldo inconsistente para liquidação.');
      }

      await tx.wallet.update({
        where: { id: auctioneerWallet.id },
        data: {
          balanceInCents: { increment: amount },
        },
      });

      const settlement = await tx.settlement.create({
        data: {
          lotId,
          winnerId: lot.winningBidderId,
          auctioneerId: lot.auctioneerId,
          amountInCents: amount,
          status: SettlementStatus.COMPLETED,
        },
      });

      await tx.walletTransaction.createMany({
        data: [
          {
            walletId: winnerWallet.id,
            type: WalletTransactionType.AUCTION_PAYMENT,
            amountInCents: -amount,
            referenceId: settlement.id,
          },
          {
            walletId: auctioneerWallet.id,
            type: WalletTransactionType.AUCTION_RECEIPT,
            amountInCents: amount,
            referenceId: settlement.id,
          },
        ],
      });

      await tx.walletHold.update({
        where: { id: winningHold.id },
        data: { status: WalletHoldStatus.CAPTURED },
      });

      const receipt = await tx.receipt.create({
        data: {
          lotId,
          settlementId: settlement.id,
          publicToken: randomUUID(),
        },
      });

      await tx.lot.update({
        where: { id: lotId },
        data: { status: LotStatus.CLOSED },
      });

      return {
        settlementId: settlement.id,
        receiptToken: receipt.publicToken,
        alreadySettled: false,
      };
    },
    {
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
