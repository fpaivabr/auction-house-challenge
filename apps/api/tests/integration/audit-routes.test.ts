import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../../src/app.js';
import { UserRole } from '../../src/generated/prisma/client.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';
import { createAccessToken } from '../../src/shared/security/token.js';

let auctioneerToken: string;
let bidderToken: string;

beforeAll(async () => {
  const auctioneer = await prisma.user.create({
    data: {
      name: 'Audit Route Auctioneer',
      email: `audit-route-auctioneer-${randomUUID()}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.AUCTIONEER,
    },
  });

  const bidder = await prisma.user.create({
    data: {
      name: 'Audit Route Bidder',
      email: `audit-route-bidder-${randomUUID()}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.BIDDER,
    },
  });

  auctioneerToken = await createAccessToken(auctioneer.id);
  bidderToken = await createAccessToken(bidder.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Audit verification API', () => {
  it('should reject unauthenticated requests', async () => {
    const response = await request(app).get('/api/audit/verify');

    expect(response.status).toBe(401);
  });

  it('should deny access to bidders', async () => {
    const response = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${bidderToken}`);

    expect(response.status).toBe(403);
  });

  it('should allow auctioneers to verify an intact chain', async () => {
    const response = await request(app)
      .get('/api/audit/verify')
      .set('Authorization', `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.audit.valid).toBe(true);
    expect(response.body.audit.error).toBeNull();
  });

  it('should report a tampered chain with HTTP 409', async () => {
    const entry = await prisma.$transaction((tx) =>
      appendAuditEntry(tx, {
        eventType: 'AUDIT_ROUTE_TEST',
        entityType: 'AuditTest',
        entityId: randomUUID(),
        payload: {
          description: 'Original event',
        },
      }),
    );

    try {
      await prisma.auditEntry.update({
        where: { id: entry.id },
        data: {
          payload: {
            description: 'Tampered event',
          },
        },
      });

      const response = await request(app)
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${auctioneerToken}`);

      expect(response.status).toBe(409);
      expect(response.body.audit.valid).toBe(false);
      expect(response.body.audit.error).toBe('Assinatura de auditoria inválida.');
    } finally {
      // Restaura o evento original para não afetar a cadeia.
      await prisma.auditEntry.update({
        where: { id: entry.id },
        data: {
          payload: {
            description: 'Original event',
          },
        },
      });
    }
  });
});
