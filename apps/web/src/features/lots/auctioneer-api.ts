import type { Lot } from './lots-api';

export type ManagedLot = Omit<Lot, 'status'> & {
  status: Lot['status'] | 'DRAFT' | 'CANCELLED';
};

export type ExternalProduct = {
  id: number;
  title: string;
  description: string;
  thumbnail?: string;
  images?: string[];
  alreadyListed: boolean;
};

type ProductsResponse = {
  products: ExternalProduct[];
  total: number;
  skip: number;
  limit: number;
};

export type CreateLotInput = {
  productId: number;
  initialPriceInCents: number;
  minimumIncrementInCents: number;
};

export type PublishLotInput = {
  startsAt: string;
  endsAt: string;
};

export type AuctioneerSummary = {
  totalLots: number;
  openLots: number;
  closedLots: number;
  completedSales: number;
  totalReceivedInCents: string;
  results: {
    lotId: string;
    amountInCents: string;
    settledAt: string;
  }[];
};

async function request<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.';

    if (payload && typeof payload === 'object') {
      if ('message' in payload && typeof payload.message === 'string') {
        message = payload.message;
      } else if ('error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    }

    throw new Error(message);
  }

  return payload as T;
}

export async function searchProducts(search: string) {
  const query = new URLSearchParams();

  if (search.trim()) {
    query.set('search', search.trim());
  }

  const suffix = query.size ? `?${query.toString()}` : '';

  return request<ProductsResponse>(`/products${suffix}`, null);
}

export async function getMyLots(token: string) {
  const response = await request<{ lots: ManagedLot[] }>('/lots/mine', token);

  return response.lots;
}

export async function createLot(token: string, input: CreateLotInput) {
  return request<{ lot: ManagedLot }>('/lots', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function publishLot(token: string, lotId: string, input: PublishLotInput) {
  return request<{ lot: ManagedLot }>(`/lots/${encodeURIComponent(lotId)}/publish`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelLot(token: string, lotId: string) {
  return request<{
    lot: {
      id: string;
      title: string;
      status: 'CANCELLED';
    };
  }>(`/lots/${encodeURIComponent(lotId)}/cancel`, token, {
    method: 'POST',
  });
}

export async function getAuctioneerSummary(token: string): Promise<AuctioneerSummary> {
  const response = await request<{ summary: AuctioneerSummary }>('/lots/mine/summary', token);

  return response.summary;
}
