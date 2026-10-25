import { LotStatus, WalletHoldStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

type PlaceBidInput = {
  lotId: string;
  bidderId: string;
  amountInCents: bigint;
};

const TWO_MINUTES = 2 * 60 * 1000;

export async function placeBid(input: PlaceBidInput) {
  return prisma.$transaction(
    async (tx) => {
      // Serializa as disputas pelo mesmo lote.
      const lockedLots = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Lot"
        WHERE id = ${input.lotId}::uuid
        FOR UPDATE
      `;

      if (lockedLots.length === 0) {
        throw new AppError(404, 'Lote não encontrado.');
      }

      const lot = await tx.lot.findUniqueOrThrow({
        where: { id: input.lotId },
      });

      const activeHold = await tx.walletHold.findFirst({
        where: {
          lotId: lot.id,
          status: WalletHoldStatus.ACTIVE,
        },
      });

      // Todas as mudanças de reservas deverão usar
      // o mesmo protocolo de bloqueio de carteiras.
      const walletOwners = [input.bidderId, ...(activeHold ? [activeHold.userId] : [])].sort();

      for (const userId of new Set(walletOwners)) {
        const lockedWallets = await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM "Wallet"
          WHERE "userId" = ${userId}::uuid
          FOR UPDATE
        `;

        if (lockedWallets.length === 0) {
          throw new AppError(422, 'Carteira não encontrada.');
        }
      }

      // Verifica o horário depois de obter os bloqueios.
      const now = new Date();

      if (
        lot.status !== LotStatus.OPEN ||
        !lot.startsAt ||
        !lot.endsAt ||
        lot.startsAt > now ||
        lot.endsAt <= now
      ) {
        throw new AppError(409, 'Este leilão não está aberto para lances.');
      }

      if (lot.auctioneerId === input.bidderId) {
        throw new AppError(403, 'O leiloeiro não pode dar lances.');
      }

      if (activeHold?.userId === input.bidderId) {
        throw new AppError(409, 'Você já está liderando este leilão.');
      }

      const minimumBid =
        lot.currentPriceInCents === null
          ? lot.initialPriceInCents
          : lot.currentPriceInCents + lot.minimumIncrementInCents;

      if (input.amountInCents < minimumBid) {
        throw new AppError(422, `O lance mínimo permitido é ${minimumBid.toString()} centavos.`);
      }

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: input.bidderId },
      });

      const activeReservations = await tx.walletHold.aggregate({
        where: {
          userId: input.bidderId,
          status: WalletHoldStatus.ACTIVE,
        },
        _sum: { amountInCents: true },
      });

      const reserved = activeReservations._sum.amountInCents ?? 0n;
      const available = wallet.balanceInCents - reserved;

      if (available < input.amountInCents) {
        throw new AppError(422, 'Saldo disponível insuficiente.');
      }

      const bid = await tx.bid.create({
        data: {
          lotId: lot.id,
          bidderId: input.bidderId,
          amountInCents: input.amountInCents,
        },
      });

      if (activeHold) {
        await tx.walletHold.update({
          where: { id: activeHold.id },
          data: { status: WalletHoldStatus.RELEASED },
        });
      }

      await tx.walletHold.create({
        data: {
          lotId: lot.id,
          userId: input.bidderId,
          bidId: bid.id,
          amountInCents: input.amountInCents,
          status: WalletHoldStatus.ACTIVE,
        },
      });

      const remaining = lot.endsAt.getTime() - now.getTime();

      const endsAt =
        remaining <= TWO_MINUTES ? new Date(lot.endsAt.getTime() + TWO_MINUTES) : lot.endsAt;

      await tx.lot.update({
        where: { id: lot.id },
        data: {
          currentPriceInCents: input.amountInCents,
          winningBidderId: input.bidderId,
          endsAt,
        },
      });

      return {
        id: bid.id,
        lotId: bid.lotId,
        bidderId: bid.bidderId,
        amountInCents: bid.amountInCents.toString(),
        createdAt: bid.createdAt,
        endsAt,
        availableBalanceInCents: (available - input.amountInCents).toString(),
      };
    },
    {
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
