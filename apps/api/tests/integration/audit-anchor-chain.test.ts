import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  verifyAuditAnchorAgainstChain,
  writeAuditAnchor,
} from '../../src/modules/audit/audit-anchor.service.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';

let directory: string;
let anchorPath: string;
let entryId: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'audit-chain-test-'));
  anchorPath = join(directory, 'anchor.json');

  const entry = await prisma.$transaction((tx) =>
    appendAuditEntry(tx, {
      eventType: 'ANCHOR_TEST',
      entityType: 'AuditTest',
      entityId: randomUUID(),
      payload: {
        description: 'Anchored event for integration testing',
      },
    }),
  );

  entryId = entry.id;

  await writeAuditAnchor(anchorPath, entry.sequence, entry.hash);
});

afterAll(async () => {
  try {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe('Audit anchor and database chain', () => {
  it('should accept an anchored event matching the database', async () => {
    const result = await verifyAuditAnchorAgainstChain(anchorPath);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should detect deletion of the anchored final event', async () => {
    const original = await prisma.auditEntry.findUniqueOrThrow({
      where: { id: entryId },
    });

    try {
      await prisma.auditEntry.delete({
        where: { id: entryId },
      });

      const result = await verifyAuditAnchorAgainstChain(anchorPath);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Evento ancorado não encontrado no histórico.');
    } finally {
      // Restaura a entrada original para preservar a cadeia.
      await prisma.auditEntry.create({
        data: {
          id: original.id,
          sequence: original.sequence,
          eventType: original.eventType,
          entityType: original.entityType,
          entityId: original.entityId,
          payload: original.payload as {
            description: string;
          },
          previousHash: original.previousHash,
          hash: original.hash,
          createdAt: original.createdAt,
        },
      });
    }

    const restored = await verifyAuditAnchorAgainstChain(anchorPath);

    expect(restored.valid).toBe(true);
  });
});
