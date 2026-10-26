import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LotStatus, UserRole } from '../../src/generated/prisma/client.js';
import {
  appendAuditEntry,
  verifyBidAuditConsistency,
} from '../../src/modules/audit/audit.service.js';
import { prisma } from '../../src/shared/database/prisma.js';

const suffix = randomUUID();

let auctioneerId: string;
let bidderId: string;
let lotId: string;
let bidId: string;

beforeAll(async () => {
  const auctioneer = await prisma.user.create({
    data: {
      name: 'Audit Bid Test Auctioneer',
      email: `audit-auctioneer-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.AUCTIONEER,
    },
  });

  const bidder = await prisma.user.create({
    data: {
      name: 'Audit Bid Test Bidder',
      email: `audit-bidder-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.BIDDER,
    },
  });

  auctioneerId = auctioneer.id;
  bidderId = bidder.id;

  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalItemId: `audit-${suffix}`,
      externalSource: 'test',
      title: 'Audit Bid Consistency Test',
      description: 'Checks bid and audit consistency.',
      initialPriceInCents: 10000n,
      minimumIncrementInCents: 1000n,
      status: LotStatus.CLOSED,
    },
  });

  lotId = lot.id;

  await prisma.$transaction(async (tx) => {
    const bid = await tx.bid.create({
      data: {
        lotId,
        bidderId,
        amountInCents: 10000n,
      },
    });

    bidId = bid.id;

    await appendAuditEntry(tx, {
      eventType: 'BID_PLACED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {
        bidId: bid.id,
        lotId,
        bidderId,
        amountInCents: '10000',
        previousPriceInCents: '',
        endsAt: new Date().toISOString(),
      },
    });
  });
});

afterAll(async () => {
  try {
    await prisma.bid.deleteMany({
      where: { lotId },
    });

    await prisma.lot.deleteMany({
      where: { id: lotId },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [auctioneerId, bidderId] },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
});

describe('Bid and audit consistency', () => {
  it('should accept a bid matching its signed audit event', async () => {
    const result = await verifyBidAuditConsistency(lotId);

    expect(result.valid).toBe(true);
    expect(result.checkedBids).toBe(1);
  });

  it('should detect unauthorized changes to the bid amount', async () => {
    await prisma.bid.update({
      where: { id: bidId },
      data: { amountInCents: 90000n },
    });

    try {
      const result = await verifyBidAuditConsistency(lotId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Dados do lance divergentes da auditoria.');
    } finally {
      await prisma.bid.update({
        where: { id: bidId },
        data: { amountInCents: 10000n },
      });
    }
  });

  it('should detect a bid inserted without an audit event', async () => {
    const inserted = await prisma.bid.create({
      data: {
        lotId,
        bidderId,
        amountInCents: 20000n,
      },
    });

    try {
      const result = await verifyBidAuditConsistency(lotId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantidade de lances diferente do histórico auditado.');
    } finally {
      await prisma.bid.delete({
        where: { id: inserted.id },
      });
    }
  });

  it('should detect a bid deleted directly from the database', async () => {
    const original = await prisma.bid.findUniqueOrThrow({
      where: { id: bidId },
    });

    try {
      // Simula uma exclusão indevida diretamente no banco.
      await prisma.bid.delete({
        where: { id: bidId },
      });

      const result = await verifyBidAuditConsistency(lotId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantidade de lances diferente do histórico auditado.');
    } finally {
      // Restaura o lance para não prejudicar os outros testes.
      await prisma.bid.create({
        data: {
          id: original.id,
          lotId: original.lotId,
          bidderId: original.bidderId,
          amountInCents: original.amountInCents,
          createdAt: original.createdAt,
        },
      });
    }
  });
});
