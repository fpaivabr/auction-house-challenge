import type { RequestHandler } from 'express';
import type { UserRole } from '../../generated/prisma/client.js';

import { AppError } from '../errors/app-error.js';

export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const user = res.locals.user;

    if (!user) {
      throw new AppError(401, 'Autenticação obrigatória.');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(403, 'Você não tem permissão para esta operação.');
    }

    next();
  };
}
