import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  LotStatus,
  UserRole,
  WalletHoldStatus,
  WalletTransactionType,
} from '../../src/generated/prisma/client.js';
import { settleLot } from '../../src/modules/lots/lots.settlement.js';
import { prisma } from '../../src/shared/database/prisma.js';
import { synchronizeLotStatuses } from '../../src/modules/lots/lots.lifecycle.js';
import { appendAuditEntry } from '../../src/modules/audit/audit.service.js';

const suffix = randomUUID();
const userIds: string[] = [];
const lotIds: string[] = [];

let auctioneerId: string;
let bidderId: string;

const AMOUNT = 10000n;

beforeAll(async () => {
  const auctioneer = await prisma.user.create({
    data: {
      name: 'Settlement Test Auctioneer',
      email: `settlement-auctioneer-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.AUCTIONEER,
      wallet: {
        create: { balanceInCents: 0n },
      },
    },
  });

  auctioneerId = auctioneer.id;
  userIds.push(auctioneer.id);

  const bidder = await prisma.user.create({
    data: {
      name: 'Settlement Test Bidder',
      email: `settlement-bidder-${suffix}@example.com`,
      passwordHash: 'test-only',
      role: UserRole.BIDDER,
      wallet: {
        create: { balanceInCents: 100000n },
      },
    },
  });

  bidderId = bidder.id;
  userIds.push(bidder.id);
});

async function createLotWithWinningBid(expired = true) {
  const now = Date.now();

  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      winningBidderId: bidderId,
      externalItemId: `settlement-${randomUUID()}`,
      externalSource: 'test',
      title: 'Settlement Integration Test',
      description: 'Lot for settlement validation.',
      initialPriceInCents: AMOUNT,
      minimumIncrementInCents: 1000n,
      currentPriceInCents: AMOUNT,
      status: LotStatus.OPEN,
      startsAt: new Date(now - 3_600_000),
      endsAt: new Date(now + (expired ? -60_000 : 3_600_000)),
    },
  });

  lotIds.push(lot.id);

  const bid = await prisma.bid.create({
    data: {
      lotId: lot.id,
      bidderId,
      amountInCents: AMOUNT,
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
        bidderId,
        amountInCents: AMOUNT.toString(),
        previousPriceInCents: '',
        endsAt: lot.endsAt?.toISOString() ?? '',
      },
    }),
  );

  await prisma.walletHold.create({
    data: {
      lotId: lot.id,
      userId: bidderId,
      bidId: bid.id,
      amountInCents: AMOUNT,
      status: WalletHoldStatus.ACTIVE,
    },
  });

  return lot;
}

async function getBalance(userId: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId },
  });

  return wallet.balanceInCents;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auction settlement', () => {
  it('should transfer the winning amount exactly once', async () => {
    const lot = await createLotWithWinningBid();

    const winnerBefore = await getBalance(bidderId);
    const auctioneerBefore = await getBalance(auctioneerId);

    const result = await settleLot(lot.id);

    expect(result.alreadySettled).toBe(false);
    expect(result.receiptToken).toBeTruthy();

    expect(await getBalance(bidderId)).toBe(winnerBefore - AMOUNT);

    expect(await getBalance(auctioneerId)).toBe(auctioneerBefore + AMOUNT);

    const updatedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updatedLot.status).toBe(LotStatus.CLOSED);

    const hold = await prisma.walletHold.findFirstOrThrow({
      where: { lotId: lot.id },
    });

    expect(hold.status).toBe(WalletHoldStatus.CAPTURED);

    const settlement = await prisma.settlement.findUniqueOrThrow({
      where: { lotId: lot.id },
    });

    const transactions = await prisma.walletTransaction.findMany({
      where: { referenceId: settlement.id },
    });

    expect(transactions).toHaveLength(2);

    expect(
      transactions.find((transaction) => transaction.type === WalletTransactionType.AUCTION_PAYMENT)
        ?.amountInCents,
    ).toBe(-AMOUNT);

    expect(
      transactions.find((transaction) => transaction.type === WalletTransactionType.AUCTION_RECEIPT)
        ?.amountInCents,
    ).toBe(AMOUNT);
  });

  it('should be idempotent when settling the same lot twice', async () => {
    const lot = await createLotWithWinningBid();

    const first = await settleLot(lot.id);

    const winnerAfterFirst = await getBalance(bidderId);
    const auctioneerAfterFirst = await getBalance(auctioneerId);

    const second = await settleLot(lot.id);

    expect(second.alreadySettled).toBe(true);
    expect(second.settlementId).toBe(first.settlementId);
    expect(second.receiptToken).toBe(first.receiptToken);

    expect(await getBalance(bidderId)).toBe(winnerAfterFirst);
    expect(await getBalance(auctioneerId)).toBe(auctioneerAfterFirst);

    const settlements = await prisma.settlement.count({
      where: { lotId: lot.id },
    });

    expect(settlements).toBe(1);
  });

  it('should reject settlement before the auction ends', async () => {
    const lot = await createLotWithWinningBid(false);

    const winnerBefore = await getBalance(bidderId);

    await expect(settleLot(lot.id)).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(await getBalance(bidderId)).toBe(winnerBefore);

    const hold = await prisma.walletHold.findFirstOrThrow({
      where: { lotId: lot.id },
    });

    expect(hold.status).toBe(WalletHoldStatus.ACTIVE);
  });

  it('should automatically settle an expired lot with bids', async () => {
    const lot = await createLotWithWinningBid();

    const winnerBefore = await getBalance(bidderId);
    const auctioneerBefore = await getBalance(auctioneerId);

    const result = await synchronizeLotStatuses();

    expect(result.settled).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);

    const updatedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updatedLot.status).toBe(LotStatus.CLOSED);

    expect(await getBalance(bidderId)).toBe(winnerBefore - AMOUNT);

    expect(await getBalance(auctioneerId)).toBe(auctioneerBefore + AMOUNT);

    const settlement = await prisma.settlement.findUniqueOrThrow({
      where: { lotId: lot.id },
      include: { receipt: true },
    });

    expect(settlement.amountInCents).toBe(AMOUNT);
    expect(settlement.receipt?.publicToken).toBeTruthy();

    const hold = await prisma.walletHold.findFirstOrThrow({
      where: { lotId: lot.id },
    });

    expect(hold.status).toBe(WalletHoldStatus.CAPTURED);
  });

  it('should prevent duplicate settlement under concurrency', async () => {
    const lot = await createLotWithWinningBid();

    const winnerBefore = await getBalance(bidderId);
    const auctioneerBefore = await getBalance(auctioneerId);

    const results = await Promise.allSettled([settleLot(lot.id), settleLot(lot.id)]);

    const successful = results.filter((result) => result.status === 'fulfilled');

    // Ambas podem concluir, ou uma pode sofrer timeout.
    // O importante é que a cobrança ocorra uma única vez.
    expect(successful.length).toBeGreaterThanOrEqual(1);

    const settlements = await prisma.settlement.count({
      where: { lotId: lot.id },
    });

    expect(settlements).toBe(1);

    expect(await getBalance(bidderId)).toBe(winnerBefore - AMOUNT);

    expect(await getBalance(auctioneerId)).toBe(auctioneerBefore + AMOUNT);

    const settlement = await prisma.settlement.findUniqueOrThrow({
      where: { lotId: lot.id },
    });

    const transactions = await prisma.walletTransaction.count({
      where: { referenceId: settlement.id },
    });

    expect(transactions).toBe(2);
  });
});
