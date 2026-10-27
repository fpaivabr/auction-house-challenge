import { createHmac, randomUUID } from 'node:crypto';

import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../shared/database/prisma.js';

type AuditPayload = Record<string, string>;

type AppendAuditInput = {
  eventType: string;
  entityType: string;
  entityId: string;
  payload: AuditPayload;
};

export type AuditRecordData = {
  id: string;
  sequence: bigint;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Prisma.JsonValue;
  previousHash: string | null;
  createdAt: Date;
};

function canonicalJson(value: Prisma.JsonValue): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      const item = value[key];

      if (item === undefined) {
        throw new Error('Valor JSON inválido na auditoria.');
      }

      return `${JSON.stringify(key)}:${canonicalJson(item)}`;
    })
    .join(',')}}`;
}

export function calculateAuditHash(record: AuditRecordData): string {
  const content = JSON.stringify([
    record.id,
    record.sequence.toString(),
    record.eventType,
    record.entityType,
    record.entityId,
    canonicalJson(record.payload),
    record.previousHash,
    record.createdAt.toISOString(),
  ]);

  return createHmac('sha256', env.AUDIT_SECRET).update(content).digest('hex');
}

export async function appendAuditEntry(tx: Prisma.TransactionClient, input: AppendAuditInput) {
  // Uma única transação por vez pode avançar a cadeia global.
  // A chave numérica identifica o bloqueio consultivo no PostgreSQL.
  await tx.$queryRaw<{ acquired: number }[]>`
    SELECT 1 AS acquired
    FROM (
      SELECT pg_advisory_xact_lock(2026, 10)
    ) AS audit_lock
  `;

  const previousEntry = await tx.auditEntry.findFirst({
    orderBy: { sequence: 'desc' },
  });

  const entry: AuditRecordData = {
    id: randomUUID(),
    sequence: (previousEntry?.sequence ?? 0n) + 1n,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload,
    previousHash: previousEntry?.hash ?? null,
    createdAt: new Date(),
  };

  const hash = calculateAuditHash(entry);

  return tx.auditEntry.create({
    data: {
      id: entry.id,
      sequence: entry.sequence,
      eventType: entry.eventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: input.payload,
      previousHash: entry.previousHash,
      hash,
      createdAt: entry.createdAt,
    },
  });
}

export async function verifyAuditChain() {
  const entries = await prisma.auditEntry.findMany({
    orderBy: { sequence: 'asc' },
  });

  let previousHash: string | null = null;
  let expectedSequence = 1n;

  for (const entry of entries) {
    if (entry.sequence !== expectedSequence) {
      return {
        valid: false,
        checkedEntries: entries.length,
        error: 'Sequência de auditoria inconsistente.',
      };
    }

    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        checkedEntries: entries.length,
        error: 'Encadeamento de auditoria inválido.',
      };
    }

    const expectedHash = calculateAuditHash(entry);

    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        checkedEntries: entries.length,
        error: 'Assinatura de auditoria inválida.',
      };
    }

    previousHash = entry.hash;
    expectedSequence += 1n;
  }

  return {
    valid: true,
    checkedEntries: entries.length,
    error: null,
  };
}

export async function verifyBidAuditConsistency(lotId: string) {
  // Primeiro, verifica se os eventos de auditoria
  // continuam criptograficamente íntegros.
  const chain = await verifyAuditChain();

  if (!chain.valid) {
    return {
      valid: false,
      checkedBids: 0,
      error: chain.error,
    };
  }

  const [bids, auditEntries] = await Promise.all([
    prisma.bid.findMany({
      where: { lotId },
      orderBy: { id: 'asc' },
    }),
    prisma.auditEntry.findMany({
      where: {
        eventType: 'BID_PLACED',
        entityType: 'Bid',
      },
      orderBy: { sequence: 'asc' },
    }),
  ]);

  const events = auditEntries.filter((entry) => {
    if (!entry.payload || typeof entry.payload !== 'object' || Array.isArray(entry.payload)) {
      return false;
    }

    return entry.payload.lotId === lotId;
  });

  if (bids.length !== events.length) {
    return {
      valid: false,
      checkedBids: bids.length,
      error: 'Quantidade de lances diferente do histórico auditado.',
    };
  }

  const eventsByBidId = new Map<string, typeof events>();

  for (const event of events) {
    const existing = eventsByBidId.get(event.entityId) ?? [];
    existing.push(event);
    eventsByBidId.set(event.entityId, existing);
  }

  for (const bid of bids) {
    const matchingEvents = eventsByBidId.get(bid.id) ?? [];

    if (matchingEvents.length !== 1) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Lance sem evento de auditoria único.',
      };
    }

    const event = matchingEvents[0];

    if (
      !event ||
      !event.payload ||
      typeof event.payload !== 'object' ||
      Array.isArray(event.payload)
    ) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Evento de auditoria inválido.',
      };
    }

    const payload = event.payload;

    if (
      payload.bidId !== bid.id ||
      payload.lotId !== bid.lotId ||
      payload.bidderId !== bid.bidderId ||
      payload.amountInCents !== bid.amountInCents.toString()
    ) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Dados do lance divergentes da auditoria.',
      };
    }
  }

  return {
    valid: true,
    checkedBids: bids.length,
    error: null,
  };
}

export async function verifyAllBidAuditConsistency() {
  const chain = await verifyAuditChain();

  if (!chain.valid) {
    return {
      valid: false,
      checkedBids: 0,
      error: chain.error,
    };
  }

  const [bids, events] = await Promise.all([
    prisma.bid.findMany({
      select: {
        id: true,
        lotId: true,
        bidderId: true,
        amountInCents: true,
      },
    }),
    prisma.auditEntry.findMany({
      where: {
        eventType: 'BID_PLACED',
      },
      orderBy: { sequence: 'asc' },
    }),
  ]);

  if (bids.length !== events.length) {
    return {
      valid: false,
      checkedBids: bids.length,
      error: 'Quantidade global de lances diferente da auditoria.',
    };
  }

  const eventsByBidId = new Map<string, (typeof events)[number]>();

  for (const event of events) {
    if (
      event.entityType !== 'Bid' ||
      !event.payload ||
      typeof event.payload !== 'object' ||
      Array.isArray(event.payload)
    ) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Evento global de lance inválido.',
      };
    }

    if (eventsByBidId.has(event.entityId)) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Evento de lance duplicado.',
      };
    }

    eventsByBidId.set(event.entityId, event);
  }

  for (const bid of bids) {
    const event = eventsByBidId.get(bid.id);

    if (!event) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Lance sem evento de auditoria.',
      };
    }

    const payload = event.payload;

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      payload.bidId !== bid.id ||
      payload.lotId !== bid.lotId ||
      payload.bidderId !== bid.bidderId ||
      payload.amountInCents !== bid.amountInCents.toString()
    ) {
      return {
        valid: false,
        checkedBids: bids.length,
        error: 'Lance divergente do evento auditado.',
      };
    }
  }

  return {
    valid: true,
    checkedBids: bids.length,
    error: null,
  };
}
