import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { prisma } from './shared/database/prisma.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { lotsRouter } from './modules/lots/lots.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { receiptsRouter } from './modules/receipts/receipts.routes.js';
import { walletsRouter } from './modules/wallets/wallets.routes.js';

import { errorHandler } from './shared/middleware/error-handler.js';

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'auction-house-api',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/audit', auditRouter);
app.use('/api/products', productsRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/wallet', walletsRouter);
app.use('/api/receipts', receiptsRouter);

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

if (env.NODE_ENV === 'production') {
  const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  const webIndex = fileURLToPath(new URL('../../web/dist/index.html', import.meta.url));

  app.use(express.static(webDist));

  // Permite acessar diretamente as rotas do React Router.
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next();
      return;
    }

    res.sendFile(webIndex);
  });
}

app.use(errorHandler);
