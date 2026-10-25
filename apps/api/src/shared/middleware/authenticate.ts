import type { RequestHandler } from 'express';

import { prisma } from '../database/prisma.js';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../security/token.js';

export const authenticate: RequestHandler = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError(401, 'Autenticação obrigatória.');
  }

  const token = authorization.slice(7);

  let userId: string;

  try {
    userId = await verifyAccessToken(token);
  } catch {
    throw new AppError(401, 'Token inválido ou expirado.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'Usuário não encontrado.');
  }

  res.locals.user = user;
  next();
};
