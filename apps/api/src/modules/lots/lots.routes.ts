import { Router } from 'express';

import { LotStatus, UserRole } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { getExternalProduct } from '../products/products.service.js';
import { createLotSchema, publishLotSchema } from './lots.schemas.js';
import { publishLot } from './lots.service.js';

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

lotsRouter.post('/', authenticate, authorize(UserRole.AUCTIONEER), async (req, res) => {
  const result = createLotSchema.safeParse(req.body);

  if (!result.success) {
    throw new AppError(400, 'Dados do lote inválidos.');
  }

  const { productId, initialPriceInCents, minimumIncrementInCents } = result.data;

  const product = await getExternalProduct(productId);

  const lot = await prisma.lot.create({
    data: {
      auctioneerId: res.locals.user.id,
      externalItemId: String(product.id),
      externalSource: 'dummyjson',
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
