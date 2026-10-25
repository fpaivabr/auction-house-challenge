import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const productSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string(),
  thumbnail: z.url().optional(),
  images: z.array(z.url()).optional(),
});

const productListSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

export type ExternalProduct = z.infer<typeof productSchema>;

async function fetchExternal(path: string): Promise<unknown> {
  try {
    const response = await fetch(`https://dummyjson.com${path}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new AppError(response.status === 404 ? 404 : 502, 'Produto externo indisponível.');
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(503, 'Não foi possível consultar a API de produtos.');
  }
}

export async function listExternalProducts(search?: string) {
  const path = search
    ? `/products/search?q=${encodeURIComponent(search)}&limit=20`
    : '/products?limit=20';

  const result = productListSchema.safeParse(await fetchExternal(path));

  if (!result.success) {
    throw new AppError(502, 'Resposta inválida da API de produtos.');
  }

  return result.data;
}

export async function getExternalProduct(productId: number): Promise<ExternalProduct> {
  const result = productSchema.safeParse(await fetchExternal(`/products/${productId}`));

  if (!result.success || result.data.id !== productId) {
    throw new AppError(502, 'Produto externo inválido.');
  }

  return result.data;
}
