export type LotStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED';

export type Lot = {
  id: string;
  auctioneerId: string;
  externalItemId: string;
  externalSource: string;
  title: string;
  description: string;
  imageUrl: string | null;
  initialPriceInCents: string;
  minimumIncrementInCents: string;
  currentPriceInCents: string | null;
  status: LotStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export function formatCurrency(cents: string | null): string {
  const value = Number(cents ?? '0') / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return 'Não definido';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export const lotStatusLabel: Record<LotStatus, string> = {
  OPEN: 'Em andamento',
  SCHEDULED: 'Agendado',
  CLOSED: 'Encerrado',
};

async function apiRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Lote não encontrado.');
    }

    throw new Error('Não foi possível carregar os dados. Tente novamente.');
  }

  return (await response.json()) as T;
}

export async function getLots(signal?: AbortSignal): Promise<Lot[]> {
  const response = await apiRequest<{ lots: Lot[] }>('/lots', signal);
  return response.lots;
}

export async function getLot(id: string, signal?: AbortSignal): Promise<Lot> {
  const response = await apiRequest<{ lot: Lot }>(`/lots/${encodeURIComponent(id)}`, signal);

  return response.lot;
}

export type LotParticipation = {
  hasBid: boolean;
  isLeading: boolean;
  highestBidInCents: string | null;
};

export async function getLotParticipation(lotId: string, token: string): Promise<LotParticipation> {
  const response = await fetch(`/api/lots/${encodeURIComponent(lotId)}/participation`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Não foi possível consultar sua participação.');
  }

  const result = (await response.json()) as {
    participation: LotParticipation;
  };

  return result.participation;
}
