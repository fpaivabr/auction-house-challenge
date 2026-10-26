import { randomUUID } from 'node:crypto';

import { afterAll, describe, expect, it } from 'vitest';

import { appendAuditEntry, verifyAuditChain } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';

const auditId = randomUUID();
let entryId: string | null = null;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Audit chain integrity', () => {
  it('should accept an authentic audit entry', async () => {
    const entry = await prisma.$transaction((tx) =>
      appendAuditEntry(tx, {
        eventType: 'INTEGRITY_TEST',
        entityType: 'AuditTest',
        entityId: auditId,
        payload: {
          description: 'Original audit event',
          amountInCents: '10000',
        },
      }),
    );

    entryId = entry.id;

    const verification = await verifyAuditChain();

    expect(verification.valid).toBe(true);
    expect(verification.error).toBeNull();
    expect(verification.checkedEntries).toBeGreaterThan(0);
  });

  it('should detect direct database tampering', async () => {
    if (!entryId) {
      throw new Error('Registro de auditoria não criado.');
    }

    const original = await prisma.auditEntry.findUniqueOrThrow({
      where: { id: entryId },
    });

    try {
      // Simula uma alteração direta no PostgreSQL.
      await prisma.auditEntry.update({
        where: { id: entryId },
        data: {
          payload: {
            description: 'Modified without authorization',
            amountInCents: '90000',
          },
        },
      });

      const verification = await verifyAuditChain();

      expect(verification.valid).toBe(false);
      expect(verification.error).toBe('Assinatura de auditoria inválida.');
    } finally {
      // Restaura o conteúdo original, mesmo se o teste falhar.
      await prisma.auditEntry.update({
        where: { id: entryId },
        data: {
          payload: original.payload as {
            description: string;
            amountInCents: string;
          },
        },
      });
    }

    const restored = await verifyAuditChain();

    expect(restored.valid).toBe(true);
  });
});
