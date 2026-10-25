import { Router } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../../shared/errors/app-error.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, 'Dados de cadastro inválidos.');
    }

    throw error;
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, 'Dados de login inválidos.');
    }

    throw error;
  }
});

authRouter.get('/me', authenticate, (_req, res) => {
  res.status(200).json({
    user: res.locals.user,
  });
});
