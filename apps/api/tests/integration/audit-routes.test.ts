import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../../src/app.js';
import { LotStatus, UserRole } from '../../src/generated/prisma/client.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';
import { createAccessToken } from '../../src/shared/security/token.js';

let auctioneerToken: string;
let bidderToken: string;
let publicLotId: string;
let publicBidId: string;

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

  // Prepara um lote com um lance para testar a auditoria pública.
  const lot = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer.id,
      externalSource: 'test',
      externalItemId: `public-audit-${randomUUID()}`,
      title: 'Obra de auditoria pública',
      description: 'Lote para teste de integridade.',
      initialPriceInCents: 10000n,
      minimumIncrementInCents: 1000n,
      currentPriceInCents: 12000n,
      winningBidderId: bidder.id,
      status: LotStatus.OPEN,
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2027-01-01T10:00:00Z'),
    },
  });

  publicLotId = lot.id;

  const bid = await prisma.bid.create({
    data: {
      lotId: lot.id,
      bidderId: bidder.id,
      amountInCents: 12000n,
    },
  });

  publicBidId = bid.id;

  await prisma.$transaction((tx) =>
    appendAuditEntry(tx, {
      eventType: 'BID_PLACED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {
        bidId: bid.id,
        lotId: lot.id,
        bidderId: bidder.id,
        amountInCents: '12000',
        previousPriceInCents: '',
        endsAt: lot.endsAt?.toISOString() ?? '',
      },
    }),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Audit verification API', () => {
  // Testes existentes da auditoria administrativa.

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

  // Novos testes da auditoria pública por lote.

  it('should allow public audit access without login', async () => {
    const response = await request(app).get(`/api/audit/lots/${publicLotId}`);

    expect(response.status).toBe(200);
    expect(response.body.lot.title).toBe('Obra de auditoria pública');

    expect(response.body.bids).toHaveLength(1);

    expect(response.body.bids[0]).toMatchObject({
      position: 1,
      amountInCents: '12000',
    });

    expect(response.body.bids[0].participantCode).toMatch(/^[A-F0-9]{8}$/);

    expect(response.body.integrity.status).toBe('UNVERIFIED');

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('audit-route-bidder-');
    expect(serialized).not.toContain(publicBidId);
  });

  it('should detect a bid changed directly in the database', async () => {
    try {
      await prisma.bid.update({
        where: { id: publicBidId },
        data: {
          amountInCents: 99999n,
        },
      });

      const response = await request(app).get(`/api/audit/lots/${publicLotId}`);

      expect(response.status).toBe(409);
      expect(response.body.integrity.status).toBe('INVALID');
    } finally {
      await prisma.bid.update({
        where: { id: publicBidId },
        data: {
          amountInCents: 12000n,
        },
      });
    }
  });

  it('should reject an invalid public lot identifier', async () => {
    const response = await request(app).get('/api/audit/lots/identificador-invalido');

    expect(response.status).toBe(400);
  });
});
