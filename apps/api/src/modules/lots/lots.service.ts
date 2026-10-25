import { LotStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';

type PublishLotInput = {
  lotId: string;
  auctioneerId: string;
  startsAt: Date;
  endsAt: Date;
};

export async function publishLot(input: PublishLotInput) {
  const { lotId, auctioneerId, startsAt, endsAt } = input;

  const now = new Date();

  if (endsAt <= startsAt) {
    throw new AppError(400, 'O encerramento deve ocorrer após o início.');
  }

  if (endsAt <= now) {
    throw new AppError(400, 'O encerramento deve estar no futuro.');
  }

  const status = startsAt <= now ? LotStatus.OPEN : LotStatus.SCHEDULED;

  const result = await prisma.lot.updateMany({
    where: {
      id: lotId,
      auctioneerId,
      status: LotStatus.DRAFT,
    },
    data: {
      startsAt,
      endsAt,
      status,
    },
  });

  if (result.count === 0) {
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: {
        auctioneerId: true,
        status: true,
      },
    });

    if (!lot) {
      throw new AppError(404, 'Lote não encontrado.');
    }

    if (lot.auctioneerId !== auctioneerId) {
      throw new AppError(403, 'Este lote pertence a outro leiloeiro.');
    }

    throw new AppError(409, 'Este lote não está disponível para publicação.');
  }

  const lot = await prisma.lot.findUniqueOrThrow({
    where: { id: lotId },
  });

  return {
    id: lot.id,
    title: lot.title,
    imageUrl: lot.imageUrl,
    status: lot.status,
    startsAt: lot.startsAt,
    endsAt: lot.endsAt,
  };
}
