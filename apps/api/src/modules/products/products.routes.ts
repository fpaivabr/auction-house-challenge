import { Router } from 'express';
import { z } from 'zod';

import { AppError } from '../../shared/errors/app-error.js';
import { listExternalProducts } from './products.service.js';

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

  res.status(200).json(products);
});
