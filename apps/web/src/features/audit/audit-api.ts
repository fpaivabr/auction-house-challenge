export type PublicLotAudit = {
  lot: {
    id: string;
    title: string;
    status: 'SCHEDULED' | 'OPEN' | 'CLOSED';
  };
  bids: {
    position: number;
    participantCode: string;
    amountInCents: string;
    createdAt: string;
  }[];
  integrity: {
    status: 'VALID' | 'INVALID' | 'PENDING' | 'UNVERIFIED';
    checkedBids: number;
    message: string;
    checkpointSequence: string | null;
    pendingEntries: string | null;
  };
};

export async function getPublicLotAudit(
  lotId: string,
  signal?: AbortSignal,
): Promise<PublicLotAudit> {
  const response = await fetch(`/api/audit/lots/${encodeURIComponent(lotId)}`, { signal });

  const payload: unknown = await response.json().catch(() => null);

  // Uma inconsistência retorna 409, mas ainda precisamos
  // apresentar os dados e o motivo na tela pública.
  if (
    (response.ok || response.status === 409) &&
    payload &&
    typeof payload === 'object' &&
    'lot' in payload &&
    'bids' in payload &&
    Array.isArray(payload.bids) &&
    'integrity' in payload
  ) {
    return payload as PublicLotAudit;
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    throw new Error(payload.error);
  }

  throw new Error('Não foi possível consultar a auditoria deste lote.');
}
