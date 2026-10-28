import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/errors/app-error.js';
import { listExternalProducts } from './products.service.js';
import { prisma } from '../../shared/database/prisma.js';

export const productsRouter = Router();

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
});

productsRouter.get('/', async (req, res) => {
  const result = querySchema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(400, 'Parâmetros de busca inválidos.');
  }

  const products = await listExternalProducts(result.data.search);

  const registeredLots = await prisma.lot.findMany({
    where: {
      externalSource: 'cleveland',
      externalItemId: {
        in: products.products.map((product) => String(product.id)),
      },
    },
    select: { externalItemId: true },
  });

  const registeredIds = new Set(registeredLots.map((lot) => lot.externalItemId));

  res.status(200).json({
    ...products,
    products: products.products.map((product) => ({
      ...product,
      alreadyListed: registeredIds.has(String(product.id)),
    })),
  });
});
