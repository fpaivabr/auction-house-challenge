export type Wallet = {
  balanceInCents: string;
  reservedInCents: string;
  availableInCents: string;
  currency: string;
};

export type WalletTransaction = {
  id: string;
  type: string;
  amountInCents: string;
  referenceId: string | null;
  createdAt: string;
};

export type BidResult = {
  id: string;
  lotId: string;
  bidderId: string;
  amountInCents: string;
  createdAt: string;
  endsAt: string;
  availableBalanceInCents: string;
};

async function authenticatedRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = 'Não foi possível concluir a operação.';

    if (payload && typeof payload === 'object') {
      if ('error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    }

    throw new Error(message);
  }

  return payload as T;
}

export async function getWallet(token: string): Promise<Wallet> {
  const response = await authenticatedRequest<{ wallet: Wallet }>('/wallet/me', token);

  return response.wallet;
}

export async function getWalletTransactions(token: string): Promise<WalletTransaction[]> {
  const response = await authenticatedRequest<{
    transactions: WalletTransaction[];
  }>('/wallet/me/transactions', token);

  return response.transactions;
}

export async function placeBid(
  lotId: string,
  amountInCents: number,
  token: string,
): Promise<BidResult> {
  const response = await authenticatedRequest<{ bid: BidResult }>(
    `/lots/${encodeURIComponent(lotId)}/bids`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ amountInCents }),
    },
  );

  return response.bid;
}
