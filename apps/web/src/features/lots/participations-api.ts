export type ParticipationOutcome = 'LEADING' | 'OUTBID' | 'WON' | 'LOST' | 'PENDING' | 'REVERSED';

export type MyLotParticipation = {
  lot: {
    id: string;
    title: string;
    imageUrl: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
    currentPriceInCents: string | null;
    endsAt: string | null;
  };
  highestBidInCents: string | null;
  outcome: ParticipationOutcome;
  receiptToken: string | null;
};

export async function getMyParticipations(token: string): Promise<MyLotParticipation[]> {
  const response = await fetch('/api/lots/participations/mine', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
    ) {
      throw new Error(payload.error);
    }

    throw new Error('Não foi possível carregar suas participações.');
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('participations' in payload) ||
    !Array.isArray(payload.participations)
  ) {
    throw new Error('A API retornou uma resposta inválida.');
  }

  return payload.participations as MyLotParticipation[];
}
