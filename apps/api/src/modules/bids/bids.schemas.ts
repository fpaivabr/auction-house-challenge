import { z } from 'zod';

export const placeBidSchema = z
  .object({
    amountInCents: z.number().int().positive().safe(),
  })
  .strict();
