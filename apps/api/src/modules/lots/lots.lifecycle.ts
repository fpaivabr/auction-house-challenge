import { LotStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { settleLot } from './lots.settlement.js';

export async function synchronizeLotStatuses(now = new Date()) {
  const opened = await prisma.lot.updateMany({
    where: {
      status: LotStatus.SCHEDULED,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    data: {
      status: LotStatus.OPEN,
    },
  });

  // Lotes sem lances podem ser encerrados diretamente.
  const closedWithoutBids = await prisma.lot.updateMany({
    where: {
      status: {
        in: [LotStatus.SCHEDULED, LotStatus.OPEN],
      },
      endsAt: { lte: now },
      bids: { none: {} },
    },
    data: {
      status: LotStatus.CLOSED,
    },
  });

  // Lotes com lances exigem liquidação financeira.
  const expiredLotsWithBids = await prisma.lot.findMany({
    where: {
      status: {
        in: [LotStatus.SCHEDULED, LotStatus.OPEN],
      },
      endsAt: { lte: now },
      bids: { some: {} },
    },
    select: { id: true },
    orderBy: { endsAt: 'asc' },
    take: 100,
  });

  let settled = 0;
  let failed = 0;

  for (const lot of expiredLotsWithBids) {
    try {
      const result = await settleLot(lot.id, now);

      if (!result.alreadySettled) {
        settled++;
      }
    } catch (error) {
      failed++;
      console.error(`Falha ao liquidar o lote ${lot.id}:`, error);
    }
  }

  return {
    opened: opened.count,
    closed: closedWithoutBids.count + settled,
    settled,
    failed,
  };
}
