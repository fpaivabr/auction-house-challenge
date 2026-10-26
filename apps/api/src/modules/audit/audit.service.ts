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
