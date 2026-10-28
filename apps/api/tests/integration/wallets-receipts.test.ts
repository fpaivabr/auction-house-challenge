import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { app } from '../../src/app.js';
import {
  LotStatus,
  UserRole,
  WalletHoldStatus,
  WalletTransactionType,
} from '../../src/generated/prisma/client.js';
import { prisma } from '../../src/shared/database/prisma.js';
import { createAccessToken } from '../../src/shared/security/token.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';

const suffix = randomUUID();
const ids = {
  auctioneer: '',
  bidder: '',
  otherBidder: '',
  lot: '',
  receipt: '',
  settlement: '',
};

let bidderToken: string;
let otherBidderToken: string;

beforeAll(async () => {
  const auctioneer = await prisma.user.create({
    data: {
      name: 'Wallet Test Auctioneer',
      email: `wallet-auctioneer-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.AUCTIONEER,
      wallet: { create: { balanceInCents: 0n } },
    },
  });

  const bidder = await prisma.user.create({
    data: {
      name: 'Wallet Test Bidder',
      email: `wallet-bidder-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.BIDDER,
      wallet: { create: { balanceInCents: 100000n } },
    },
  });

  const otherBidder = await prisma.user.create({
    data: {
      name: 'Wallet Test Other Bidder',
      email: `wallet-other-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.BIDDER,
      wallet: { create: { balanceInCents: 50000n } },
    },
  });

  ids.auctioneer = auctioneer.id;
  ids.bidder = bidder.id;
  ids.otherBidder = otherBidder.id;

  bidderToken = await createAccessToken(bidder.id);
  otherBidderToken = await createAccessToken(otherBidder.id);

  const lot = await prisma.lot.create({
    data: {
      auctioneerId: auctioneer.id,
      externalSource: 'test',
      externalItemId: `wallet-test-${suffix}`,
      title: 'Wallet Test Product',
      description: 'Financial API integration test.',
      initialPriceInCents: 15000n,
      minimumIncrementInCents: 1000n,
      currentPriceInCents: 15000n,
      winningBidderId: bidder.id,
      status: LotStatus.CLOSED,
      startsAt: new Date('2026-01-01T10:00:00Z'),
      endsAt: new Date('2026-01-01T11:00:00Z'),
    },
  });

  ids.lot = lot.id;

  const bid = await prisma.bid.create({
    data: {
      lotId: lot.id,
      bidderId: bidder.id,
      amountInCents: 15000n,
    },
  });

  await prisma.$transaction((tx) =>
    appendAuditEntry(tx, {
      eventType: 'BID_PLACED',
      entityType: 'Bid',
      entityId: bid.id,
      payload: {
        bidId: bid.id,
        lotId: lot.id,
        bidderId: bidder.id,
        amountInCents: '15000',
        previousPriceInCents: '',
        endsAt: lot.endsAt?.toISOString() ?? '',
      },
    }),
  );

  await prisma.walletHold.create({
    data: {
      lotId: lot.id,
      userId: bidder.id,
      bidId: bid.id,
      amountInCents: 15000n,
      status: WalletHoldStatus.ACTIVE,
    },
  });

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: bidder.id },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: WalletTransactionType.INITIAL_CREDIT,
      amountInCents: 100000n,
    },
  });

  const settlement = await prisma.settlement.create({
    data: {
      lotId: lot.id,
      auctioneerId: auctioneer.id,
      winnerId: bidder.id,
      amountInCents: 15000n,
    },
  });

  ids.settlement = settlement.id;

  const receipt = await prisma.receipt.create({
    data: {
      lotId: lot.id,
      settlementId: settlement.id,
      publicToken: randomUUID(),
    },
  });

  ids.receipt = receipt.publicToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Wallet and receipt API', () => {
  it('should require authentication for wallet access', async () => {
    const response = await request(app).get('/api/wallet/me');

    expect(response.status).toBe(401);
  });

  it('should return total, reserved and available balances', async () => {
    const response = await request(app)
      .get('/api/wallet/me')
      .set('Authorization', `Bearer ${bidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.wallet).toEqual({
      balanceInCents: '100000',
      reservedInCents: '15000',
      availableInCents: '85000',
      currency: 'BRL',
    });
  });

  it('should isolate wallets by authenticated user', async () => {
    const response = await request(app)
      .get('/api/wallet/me')
      .set('Authorization', `Bearer ${otherBidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.wallet).toEqual({
      balanceInCents: '50000',
      reservedInCents: '0',
      availableInCents: '50000',
      currency: 'BRL',
    });
  });

  it('should return only the current user transactions', async () => {
    const response = await request(app)
      .get('/api/wallet/me/transactions')
      .set('Authorization', `Bearer ${bidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.transactions).toHaveLength(1);
    expect(response.body.transactions[0]).toMatchObject({
      type: 'INITIAL_CREDIT',
      amountInCents: '100000',
    });
  });

  it('should reject unauthenticated transaction access', async () => {
    const response = await request(app).get('/api/wallet/me/transactions');

    expect(response.status).toBe(401);
  });

  it('should return a public receipt without personal data', async () => {
    const response = await request(app).get(`/api/receipts/${ids.receipt}`);

    expect(response.status).toBe(200);
    expect(response.body.receipt.amountInCents).toBe('15000');
    expect(response.body.receipt.lot.title).toBe('Wallet Test Product');

    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain(ids.bidder);
    expect(serialized).not.toContain(ids.auctioneer);
    expect(serialized).not.toContain('wallet-bidder-');
    expect(serialized).not.toContain('wallet-auctioneer-');
  });

  it('should reject an unknown receipt token', async () => {
    const response = await request(app).get(`/api/receipts/${randomUUID()}`);

    expect(response.status).toBe(404);
  });

  it('should require authentication to list my receipts', async () => {
    const response = await request(app).get('/api/receipts/mine');

    expect(response.status).toBe(401);
  });

  it('should list only receipts owned by the authenticated winner', async () => {
    const response = await request(app)
      .get('/api/receipts/mine')
      .set('Authorization', `Bearer ${bidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.receipts).toHaveLength(1);

    expect(response.body.receipts[0]).toMatchObject({
      token: ids.receipt,
      amountInCents: '15000',
      currency: 'BRL',
      status: 'COMPLETED',
      lot: {
        id: ids.lot,
        title: 'Wallet Test Product',
      },
    });
  });

  it('should not show another participant receipts', async () => {
    const response = await request(app)
      .get('/api/receipts/mine')
      .set('Authorization', `Bearer ${otherBidderToken}`);

    expect(response.status).toBe(200);
    expect(response.body.receipts).toEqual([]);
  });

  it('should reject auctioneers from the participant receipt list', async () => {
    const auctioneerToken = await createAccessToken(ids.auctioneer);

    const response = await request(app)
      .get('/api/receipts/mine')
      .set('Authorization', `Bearer ${auctioneerToken}`);

    expect(response.status).toBe(403);
  });
});
