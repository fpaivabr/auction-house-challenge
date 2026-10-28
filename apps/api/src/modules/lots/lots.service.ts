import { LotStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { appendAuditEntry } from '../audit/audit.service.js';

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

type CancelLotInput = {
  lotId: string;
  auctioneerId: string;
};

export async function cancelLot(input: CancelLotInput) {
  return prisma.$transaction(async (tx) => {
    // Usa o mesmo bloqueio de lote empregado no registro de lances.
    // Isso impede que um lance e um cancelamento sejam confirmados
    // simultaneamente para o mesmo leilão.
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

    if (lot.auctioneerId !== input.auctioneerId) {
      throw new AppError(403, 'Este lote pertence a outro leiloeiro.');
    }

    if (
      lot.status !== LotStatus.DRAFT &&
      lot.status !== LotStatus.SCHEDULED &&
      lot.status !== LotStatus.OPEN
    ) {
      throw new AppError(409, 'Este lote não pode mais ser cancelado.');
    }

    if (lot.endsAt && lot.endsAt <= new Date()) {
      throw new AppError(409, 'Um leilão encerrado não pode ser cancelado.');
    }

    const bidCount = await tx.bid.count({
      where: { lotId: lot.id },
    });

    if (bidCount > 0) {
      throw new AppError(409, 'Não é possível cancelar um lote que já recebeu lances.');
    }

    const updatedLot = await tx.lot.update({
      where: { id: lot.id },
      data: { status: LotStatus.CANCELLED },
    });

    await appendAuditEntry(tx, {
      eventType: 'LOT_CANCELLED',
      entityType: 'Lot',
      entityId: lot.id,
      payload: {
        lotId: lot.id,
        auctioneerId: input.auctioneerId,
        previousStatus: lot.status,
      },
    });

    return {
      id: updatedLot.id,
      title: updatedLot.title,
      status: updatedLot.status,
    };
  });
}
