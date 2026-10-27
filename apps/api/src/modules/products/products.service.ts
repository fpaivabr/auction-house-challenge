import { z } from 'zod';

import { AppError } from '../../shared/errors/app-error.js';

const API_BASE = 'https://openaccess-api.clevelandart.org/api/artworks';

const artworkSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  creation_date: z.string().nullish(),
  technique: z.string().nullish(),
  share_license_status: z.string().nullish(),
  creators: z
    .array(
      z.object({
        description: z.string().nullish(),
      }),
    )
    .nullish(),
  images: z
    .object({
      web: z
        .object({
          url: z.string().url(),
        })
        .nullish(),
    })
    .nullish(),
});

const artworkListSchema = z.object({
  info: z.object({
    total: z.number(),
  }),
  data: z.array(artworkSchema),
});

const artworkDetailSchema = z.object({
  data: artworkSchema,
});

export type ExternalProduct = {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  images: string[];
};

type Artwork = z.infer<typeof artworkSchema>;

function toProduct(artwork: Artwork): ExternalProduct | null {
  const imageUrl = artwork.images?.web?.url;

  if (artwork.share_license_status !== 'CC0' || !imageUrl) {
    return null;
  }

  const artists =
    artwork.creators
      ?.map((creator) => creator.description)
      .filter((value): value is string => Boolean(value?.trim()))
      .join(', ') ?? '';

  const description = [artists, artwork.creation_date, artwork.technique]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' • ');

  return {
    id: artwork.id,
    title: artwork.title,
    description: description || 'Obra do acervo do Cleveland Museum of Art.',
    thumbnail: imageUrl,
    images: [imageUrl],
  };
}

async function fetchExternal(path: string): Promise<unknown> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new AppError(
        response.status === 404 ? 404 : 502,
        'Obra de arte indisponível na API externa.',
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(503, 'Não foi possível consultar o acervo de obras de arte.');
  }
}

export async function listExternalProducts(search?: string) {
  const params = new URLSearchParams({
    q: search?.trim() || 'painting',
    limit: '50',
    has_image: '1',
  });

  // A documentação disponibiliza o filtro CC0 para obras
  // cujas imagens podem ser reutilizadas.
  params.append('cc0', '');

  const result = artworkListSchema.safeParse(await fetchExternal(`/?${params.toString()}`));

  if (!result.success) {
    throw new AppError(502, 'Resposta inválida da API de obras de arte.');
  }

  const products = result.data.data
    .map(toProduct)
    .filter((product): product is ExternalProduct => product !== null)
    .slice(0, 20);

  return {
    products,
    total: result.data.info.total,
    skip: 0,
    limit: 20,
  };
}

export async function getExternalProduct(productId: number): Promise<ExternalProduct> {
  const result = artworkDetailSchema.safeParse(await fetchExternal(`/${productId}`));

  if (!result.success || result.data.data.id !== productId) {
    throw new AppError(502, 'Resposta inválida da API de obras de arte.');
  }

  const product = toProduct(result.data.data);

  if (!product) {
    throw new AppError(422, 'Esta obra não possui imagem disponível em domínio público.');
  }

  return product;
}
