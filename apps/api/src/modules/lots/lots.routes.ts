import { Router } from 'express';

import { LotStatus, Prisma, SettlementStatus, UserRole } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { getExternalProduct } from '../products/products.service.js';
import { createLotSchema, publishLotSchema } from './lots.schemas.js';
import { cancelLot, publishLot } from './lots.service.js';
import { placeBidSchema } from '../bids/bids.schemas.js';
import { placeBid } from '../bids/bids.service.js';
import { publishLotUpdate, subscribeToLotUpdates } from './lot-events.js';

export const lotsRouter = Router();

const visibleStatuses: LotStatus[] = [LotStatus.SCHEDULED, LotStatus.OPEN, LotStatus.CLOSED];

function serializeLot(lot: {
  id: string;
  auctioneerId: string;
  externalItemId: string;
  externalSource: string;
  title: string;
  description: string;
  imageUrl: string | null;
  initialPriceInCents: bigint;
  minimumIncrementInCents: bigint;
  currentPriceInCents: bigint | null;
  status: LotStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...lot,
    initialPriceInCents: lot.initialPriceInCents.toString(),
    minimumIncrementInCents: lot.minimumIncrementInCents.toString(),
    currentPriceInCents: lot.currentPriceInCents?.toString() ?? null,
  };
}

lotsRouter.post('/:id/bids', authenticate, authorize(UserRole.BIDDER), async (req, res) => {
  const lotId = String(req.params.id);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const result = placeBidSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(400, 'Valor de lance inválido.');
  }

  const bid = await placeBid({
    lotId,
    bidderId: res.locals.user.id,
    amountInCents: BigInt(result.data.amountInCents),
  });

  publishLotUpdate(lotId);

  res.status(201).json({ bid });
});

lotsRouter.post('/', authenticate, authorize(UserRole.AUCTIONEER), async (req, res) => {
  const result = createLotSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(400, 'Dados do lote inválidos.');
  }

  const { productId, initialPriceInCents, minimumIncrementInCents } = result.data;

  const existingLot = await prisma.lot.findFirst({
    where: {
      externalSource: 'cleveland',
      externalItemId: String(productId),
    },
    select: { id: true },
  });

  if (existingLot) {
    throw new AppError(
      409,
      'Esta obra de arte já foi cadastrada em um lote e não pode ser cadastrada novamente.',
    );
  }

  const product = await getExternalProduct(productId);

  try {
    const lot = await prisma.lot.create({
      data: {
        auctioneerId: res.locals.user.id,
        externalItemId: String(product.id),
        externalSource: 'cleveland',
        title: product.title,
        description: product.description,
        imageUrl: product.thumbnail ?? product.images?.[0] ?? null,
        initialPriceInCents: BigInt(initialPriceInCents),
        minimumIncrementInCents: BigInt(minimumIncrementInCents),
        status: LotStatus.DRAFT,
      },
    });

    res.status(201).json({
      lot: serializeLot(lot),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        409,
        'Esta obra de arte já foi cadastrada em um lote e não pode ser cadastrada novamente.',
      );
    }

    throw error;
  }
});

lotsRouter.post('/:id/publish', authenticate, authorize(UserRole.AUCTIONEER), async (req, res) => {
  const result = publishLotSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(400, 'Datas de publicação inválidas.');
  }

  const lotId = String(req.params.id);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const lot = await publishLot({
    lotId,
    auctioneerId: res.locals.user.id,
    startsAt: new Date(result.data.startsAt),
    endsAt: new Date(result.data.endsAt),
  });

  res.status(200).json({ lot });
});

lotsRouter.post('/:id/cancel', authenticate, authorize(UserRole.AUCTIONEER), async (req, res) => {
  const lotId = String(req.params.id);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const lot = await cancelLot({
    lotId,
    auctioneerId: res.locals.user.id,
  });

  res.status(200).json({ lot });
});

lotsRouter.get('/', async (_req, res) => {
  const lots = await prisma.lot.findMany({
    where: {
      status: { in: visibleStatuses },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.status(200).json({
    lots: lots.map(serializeLot),
  });
});

lotsRouter.get(
  '/participations/mine',
  authenticate,
  authorize(UserRole.BIDDER),
  async (_req, res) => {
    const bidderId: string = res.locals.user.id;

    const lots = await prisma.lot.findMany({
      where: {
        bids: {
          some: { bidderId },
        },
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        status: true,
        currentPriceInCents: true,
        endsAt: true,
        winningBidderId: true,
        bids: {
          where: { bidderId },
          orderBy: [{ amountInCents: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            amountInCents: true,
          },
        },
        settlement: {
          select: {
            status: true,
          },
        },
        receipt: {
          select: {
            publicToken: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const participations = lots.map((lot) => {
      let outcome: 'LEADING' | 'OUTBID' | 'WON' | 'LOST' | 'PENDING' | 'REVERSED';

      if (lot.status === LotStatus.CLOSED) {
        if (lot.winningBidderId !== bidderId) {
          outcome = 'LOST';
        } else if (lot.settlement?.status === SettlementStatus.COMPLETED) {
          outcome = 'WON';
        } else if (lot.settlement?.status === SettlementStatus.REVERSED) {
          outcome = 'REVERSED';
        } else {
          outcome = 'PENDING';
        }
      } else {
        outcome = lot.winningBidderId === bidderId ? 'LEADING' : 'OUTBID';
      }

      return {
        lot: {
          id: lot.id,
          title: lot.title,
          imageUrl: lot.imageUrl,
          status: lot.status,
          currentPriceInCents: lot.currentPriceInCents?.toString() ?? null,
          endsAt: lot.endsAt,
        },
        highestBidInCents: lot.bids[0]?.amountInCents.toString() ?? null,
        outcome,
        receiptToken: outcome === 'WON' ? (lot.receipt?.publicToken ?? null) : null,
      };
    });

    res.status(200).json({ participations });
  },
);

lotsRouter.get('/mine', authenticate, authorize(UserRole.AUCTIONEER), async (_req, res) => {
  const lots = await prisma.lot.findMany({
    where: {
      auctioneerId: res.locals.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 100,
  });

  res.status(200).json({
    lots: lots.map(serializeLot),
  });
});

lotsRouter.get('/mine/summary', authenticate, authorize(UserRole.AUCTIONEER), async (_req, res) => {
  const auctioneerId: string = res.locals.user.id;

  const [statusGroups, totals, settlements] = await Promise.all([
    prisma.lot.groupBy({
      by: ['status'],
      where: { auctioneerId },
      _count: { _all: true },
    }),
    prisma.settlement.aggregate({
      where: {
        auctioneerId,
        status: SettlementStatus.COMPLETED,
      },
      _count: { _all: true },
      _sum: { amountInCents: true },
    }),
    prisma.settlement.findMany({
      where: {
        auctioneerId,
        status: SettlementStatus.COMPLETED,
      },
      select: {
        lotId: true,
        amountInCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const countStatus = (status: LotStatus): number =>
    statusGroups.find((group) => group.status === status)?._count._all ?? 0;

  res.status(200).json({
    summary: {
      totalLots: statusGroups.reduce((total, group) => total + group._count._all, 0),
      openLots: countStatus(LotStatus.OPEN),
      closedLots: countStatus(LotStatus.CLOSED),
      completedSales: totals._count._all,
      totalReceivedInCents: (totals._sum.amountInCents ?? 0n).toString(),
      results: settlements.map((settlement) => ({
        lotId: settlement.lotId,
        amountInCents: settlement.amountInCents.toString(),
        settledAt: settlement.createdAt,
      })),
    },
  });
});

lotsRouter.get('/:id/participation', authenticate, authorize(UserRole.BIDDER), async (req, res) => {
  const lotId = String(req.params.id);
  const bidderId: string = res.locals.user.id;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: {
      status: true,
      winningBidderId: true,
    },
  });

  if (!lot || !visibleStatuses.includes(lot.status)) {
    throw new AppError(404, 'Lote não encontrado.');
  }

  const highestBid = await prisma.bid.findFirst({
    where: {
      lotId,
      bidderId,
    },
    orderBy: [{ amountInCents: 'desc' }, { createdAt: 'desc' }],
    select: {
      amountInCents: true,
    },
  });

  res.status(200).json({
    participation: {
      hasBid: highestBid !== null,
      isLeading: highestBid !== null && lot.winningBidderId === bidderId,
      highestBidInCents: highestBid?.amountInCents.toString() ?? null,
    },
  });
});

lotsRouter.get('/:id/events', async (req, res) => {
  const lotId = String(req.params.id);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lotId)) {
    throw new AppError(400, 'Identificador de lote inválido.');
  }

  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { status: true },
  });

  if (!lot || !visibleStatuses.includes(lot.status)) {
    throw new AppError(404, 'Lote não encontrado.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders();
  res.write('event: ready\ndata: {}\n\n');

  const unsubscribe = subscribeToLotUpdates(lotId, () => {
    res.write('event: lot-updated\ndata: {}\n\n');
  });

  const interval = setInterval(() => {
    res.write('event: sync\ndata: {}\n\n');
  }, 15000);

  res.on('close', () => {
    clearInterval(interval);
    unsubscribe();
  });
});

lotsRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);

  const lot = await prisma.lot.findUnique({
    where: { id },
  });

  if (!lot || !visibleStatuses.includes(lot.status)) {
    throw new AppError(404, 'Lote não encontrado.');
  }

  res.status(200).json({
    lot: serializeLot(lot),
  });
});
