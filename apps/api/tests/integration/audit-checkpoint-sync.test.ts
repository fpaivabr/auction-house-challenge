import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  readLatestAuditCheckpoint,
  saveAuditCheckpoint,
  synchronizeAuditCheckpoints,
  verifyAuditCheckpoints,
} from '../../src/modules/audit/audit-checkpoint.service.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'audit-checkpoint-sync-'));
});

afterAll(async () => {
  try {
    await rm(directory, { recursive: true, force: true });
  } finally {
    await prisma.$disconnect();
  }
});

describe('Audit checkpoint synchronization', () => {
  it('should reject synchronization without an existing anchor', async () => {
    await expect(synchronizeAuditCheckpoints(directory)).rejects.toThrow();
  });

  it('should synchronize confirmed events without overwriting earlier checkpoints', async () => {
    const first = await prisma.$transaction((tx) =>
      appendAuditEntry(tx, {
        eventType: 'SYNC_TEST',
        entityType: 'AuditTest',
        entityId: randomUUID(),
        payload: { step: 'first' },
      }),
    );

    // Inicialização explícita para o cenário de teste.
    await saveAuditCheckpoint(directory, first.sequence, first.hash);

    const second = await prisma.$transaction((tx) =>
      appendAuditEntry(tx, {
        eventType: 'SYNC_TEST',
        entityType: 'AuditTest',
        entityId: randomUUID(),
        payload: { step: 'second' },
      }),
    );

    const result = await synchronizeAuditCheckpoints(directory);

    expect(result.synchronized).toBe(true);
    expect(result.created).toBeGreaterThanOrEqual(1);

    const latest = await readLatestAuditCheckpoint(directory);

    expect(latest.sequence).toBe(second.sequence);
    expect(latest.hash).toBe(second.hash);

    // Uma segunda execução não deve duplicar checkpoints.
    const repeated = await synchronizeAuditCheckpoints(directory);

    expect(repeated.created).toBe(0);
  });

  it('should verify a synchronized checkpoint', async () => {
    const result = await verifyAuditCheckpoints(directory);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.pendingEntries).toBe('0');
  });

  it('should reject a checkpoint directory with no trusted anchor', async () => {
    const missingDirectory = join(directory, 'missing');

    const result = await verifyAuditCheckpoints(missingDirectory);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Registro externo de integridade ausente ou inválido.');
  });
});
