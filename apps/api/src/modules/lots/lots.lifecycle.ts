import { LotStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';

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

  const closed = await prisma.lot.updateMany({
    where: {
      status: {
        in: [LotStatus.SCHEDULED, LotStatus.OPEN],
      },
      endsAt: { lte: now },
    },
    data: {
      status: LotStatus.CLOSED,
    },
  });

  return {
    opened: opened.count,
    closed: closed.count,
  };
}
