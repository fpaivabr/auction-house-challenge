export type AuctionReceipt = {
  token: string;
  lot: {
    id: string;
    title: string;
    imageUrl: string | null;
  };
  amountInCents: string;
  currency: string;
  status: 'COMPLETED' | 'REVERSED';
  settledAt: string;
  issuedAt: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Não foi possível carregar os comprovantes.';

    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    }

    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('A API retornou uma resposta inválida.');
  }

  return payload as T;
}

export async function getMyReceipts(token: string): Promise<AuctionReceipt[]> {
  const response = await fetch('/api/receipts/mine', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await readResponse<{
    receipts: AuctionReceipt[];
  }>(response);

  return data.receipts;
}

export async function getReceipt(
  receiptToken: string,
  signal?: AbortSignal,
): Promise<AuctionReceipt> {
  const response = await fetch(`/api/receipts/${encodeURIComponent(receiptToken)}`, { signal });

  const data = await readResponse<{
    receipt: AuctionReceipt;
  }>(response);

  return data.receipt;
}
