import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LotStatus, UserRole, WalletHoldStatus } from '../../src/generated/prisma/client.js';
import { placeBid } from '../../src/modules/bids/bids.service.js';
import { prisma } from '../../src/shared/database/prisma.js';
import { AppError } from '../../src/shared/errors/app-error.js';

const suffix = randomUUID();
const userIds: string[] = [];
const lotIds: string[] = [];

let auctioneerId: string;
let bidderOneId: string;
let bidderTwoId: string;
let lotId: string;

beforeAll(async () => {
  const createUser = async (name: string, role: UserRole, balanceInCents: bigint) => {
    const user = await prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase().replaceAll(' ', '-')}-${suffix}@example.com`,
        passwordHash: 'test-only',
        role,
        wallet: {
          create: { balanceInCents },
        },
      },
    });

    userIds.push(user.id);
    return user.id;
  };

  auctioneerId = await createUser('Auctioneer', UserRole.AUCTIONEER, 0n);
  bidderOneId = await createUser('Bidder One', UserRole.BIDDER, 100000n);
  bidderTwoId = await createUser('Bidder Two', UserRole.BIDDER, 100000n);

  const now = Date.now();

  const lot = await prisma.lot.create({
    data: {
      auctioneerId,
      externalItemId: `integration-${suffix}`,
      externalSource: 'test',
      title: 'Integration Test Lot',
      description: 'Lot for financial integration tests.',
      initialPriceInCents: 10000n,
      minimumIncrementInCents: 1000n,
      status: LotStatus.OPEN,
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 3_600_000),
    },
  });

  lotId = lot.id;
  lotIds.push(lot.id);
});

afterAll(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.walletHold.deleteMany({
        where: { lotId: { in: lotIds } },
      });

      await tx.bid.deleteMany({
        where: { lotId: { in: lotIds } },
      });

      await tx.lot.deleteMany({
        where: { id: { in: lotIds } },
      });

      await tx.walletTransaction.deleteMany({
        where: { wallet: { userId: { in: userIds } } },
      });

      await tx.wallet.deleteMany({
        where: { userId: { in: userIds } },
      });

      await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
});

describe('Auction bidding', () => {
  it('should accept the first valid bid', async () => {
    const result = await placeBid({
      lotId,
      bidderId: bidderOneId,
      amountInCents: 10000n,
    });

    expect(result.amountInCents).toBe('10000');

    const lot = await prisma.lot.findUniqueOrThrow({
      where: { id: lotId },
    });

    expect(lot.currentPriceInCents).toBe(10000n);
    expect(lot.winningBidderId).toBe(bidderOneId);

    const activeHold = await prisma.walletHold.findFirst({
      where: {
        lotId,
        status: WalletHoldStatus.ACTIVE,
      },
    });

    expect(activeHold?.amountInCents).toBe(10000n);
    expect(activeHold?.userId).toBe(bidderOneId);
  });

  it('should reject a bid from the current leader', async () => {
    await expect(
      placeBid({
        lotId,
        bidderId: bidderOneId,
        amountInCents: 15000n,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it('should reject bids below the minimum increment', async () => {
    await expect(
      placeBid({
        lotId,
        bidderId: bidderTwoId,
        amountInCents: 10500n,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
    } satisfies Partial<AppError>);
  });

  it('should release the previous hold when outbid', async () => {
    await placeBid({
      lotId,
      bidderId: bidderTwoId,
      amountInCents: 12000n,
    });

    const holds = await prisma.walletHold.findMany({
      where: { lotId },
      orderBy: { createdAt: 'asc' },
    });

    expect(holds).toHaveLength(2);

    expect(holds.find((hold) => hold.userId === bidderOneId)?.status).toBe(
      WalletHoldStatus.RELEASED,
    );

    expect(holds.find((hold) => hold.userId === bidderTwoId)?.status).toBe(WalletHoldStatus.ACTIVE);
  });

  it('should accept only one of two simultaneous equal bids', async () => {
    const now = Date.now();

    const lot = await prisma.lot.create({
      data: {
        auctioneerId,
        externalItemId: `concurrency-${randomUUID()}`,
        externalSource: 'test',
        title: 'Concurrent Bidding Test',
        description: 'Tests simultaneous bids on the same lot.',
        initialPriceInCents: 10000n,
        minimumIncrementInCents: 1000n,
        status: LotStatus.OPEN,
        startsAt: new Date(now - 60_000),
        endsAt: new Date(now + 3_600_000),
      },
    });

    lotIds.push(lot.id);

    const results = await Promise.allSettled([
      placeBid({
        lotId: lot.id,
        bidderId: bidderOneId,
        amountInCents: 10000n,
      }),
      placeBid({
        lotId: lot.id,
        bidderId: bidderTwoId,
        amountInCents: 10000n,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    const updatedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updatedLot.currentPriceInCents).toBe(10000n);

    const bids = await prisma.bid.findMany({
      where: { lotId: lot.id },
    });

    expect(bids).toHaveLength(1);

    const activeHolds = await prisma.walletHold.findMany({
      where: {
        lotId: lot.id,
        status: WalletHoldStatus.ACTIVE,
      },
    });

    expect(activeHolds).toHaveLength(1);
    expect(activeHolds[0]?.userId).toBe(updatedLot.winningBidderId);
  });

  it('should extend the auction when bidding in the last two minutes', async () => {
    const now = Date.now();
    const originalEnd = new Date(now + 60_000);

    const lot = await prisma.lot.create({
      data: {
        auctioneerId,
        externalItemId: `anti-sniping-${randomUUID()}`,
        externalSource: 'test',
        title: 'Anti-Sniping Test',
        description: 'Tests auction time extension.',
        initialPriceInCents: 10000n,
        minimumIncrementInCents: 1000n,
        status: LotStatus.OPEN,
        startsAt: new Date(now - 60_000),
        endsAt: originalEnd,
      },
    });

    lotIds.push(lot.id);

    const result = await placeBid({
      lotId: lot.id,
      bidderId: bidderOneId,
      amountInCents: 10000n,
    });

    expect(new Date(result.endsAt).getTime()).toBe(originalEnd.getTime() + 120_000);

    const updatedLot = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updatedLot.endsAt?.getTime()).toBe(originalEnd.getTime() + 120_000);
  });

  it('should prevent overspending across simultaneous auctions', async () => {
    const now = Date.now();

    const createOpenLot = async () => {
      const lot = await prisma.lot.create({
        data: {
          auctioneerId,
          externalItemId: `wallet-concurrency-${randomUUID()}`,
          externalSource: 'test',
          title: 'Wallet Concurrency Test',
          description: 'Tests simultaneous reservations.',
          initialPriceInCents: 10000n,
          minimumIncrementInCents: 1000n,
          status: LotStatus.OPEN,
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 3_600_000),
        },
      });

      lotIds.push(lot.id);

      return lot;
    };

    const [firstLot, secondLot] = await Promise.all([createOpenLot(), createOpenLot()]);

    const results = await Promise.allSettled([
      placeBid({
        lotId: firstLot.id,
        bidderId: bidderOneId,
        amountInCents: 60000n,
      }),
      placeBid({
        lotId: secondLot.id,
        bidderId: bidderOneId,
        amountInCents: 60000n,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);

    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: bidderOneId },
    });

    const reservations = await prisma.walletHold.aggregate({
      where: {
        userId: bidderOneId,
        status: WalletHoldStatus.ACTIVE,
      },
      _sum: {
        amountInCents: true,
      },
    });

    const reserved = reservations._sum.amountInCents ?? 0n;

    expect(reserved).toBeLessThanOrEqual(wallet.balanceInCents);

    const createdBids = await prisma.bid.count({
      where: {
        lotId: { in: [firstLot.id, secondLot.id] },
      },
    });

    expect(createdBids).toBe(1);
  });

  it('should reject a bid without enough available balance', async () => {
    await expect(
      placeBid({
        lotId,
        bidderId: bidderOneId,
        amountInCents: 150000n,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
    } satisfies Partial<AppError>);

    const lot = await prisma.lot.findUniqueOrThrow({
      where: { id: lotId },
    });

    expect(lot.winningBidderId).toBe(bidderTwoId);
    expect(lot.currentPriceInCents).toBe(12000n);
  });
});
