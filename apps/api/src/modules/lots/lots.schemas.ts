import { z } from 'zod';

export const createLotSchema = z
  .object({
    productId: z.number().int().positive(),
    initialPriceInCents: z.number().int().positive().max(1_000_000_000),
    minimumIncrementInCents: z.number().int().positive().max(1_000_000_000),
  })
  .strict();

export const publishLotSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(({ startsAt, endsAt }) => new Date(endsAt).getTime() > new Date(startsAt).getTime(), {
    message: 'O encerramento deve ocorrer após o início.',
    path: ['endsAt'],
  });
