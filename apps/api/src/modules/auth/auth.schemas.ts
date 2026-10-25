import { z } from 'zod';

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase().max(255),
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1),
  })
  .strict();
