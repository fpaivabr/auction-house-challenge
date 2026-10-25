import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { prisma } from './shared/database/prisma.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { errorHandler } from './shared/middleware/error-handler.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'auction-house-api',
  });
});

app.use('/api/auth', authRouter);

app.get('/health/db', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch {
    response.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});

app.use(errorHandler);
