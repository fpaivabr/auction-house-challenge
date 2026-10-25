import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { LotStatus, UserRole } from '../../src/generated/prisma/client.js';
import { synchronizeLotStatuses } from '../../src/modules/lots/lots.lifecycle.js';
import { prisma } from '../../src/shared/database/prisma.js';

const auctioneerEmail = `lifecycle-${randomUUID()}@example.com`;
const simulatedNow = new Date('2030-06-15T12:00:00.000Z');

let auctioneerId: string;

function minutesFromNow(minutes: number): Date {
  return new Date(simulatedNow.getTime() + minutes * 60_000);
}

async function createTestLot(status: LotStatus, startsAt: Date, endsAt: Date) {
  return prisma.lot.create({
    data: {
      auctioneerId,
      externalItemId: `test-${randomUUID()}`,
      externalSource: 'test',
      title: 'Test Auction Lot',
      description: 'Lot created for lifecycle integration tests.',
      initialPriceInCents: 10000n,
      minimumIncrementInCents: 1000n,
      status,
      startsAt,
      endsAt,
    },
  });
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Lifecycle Test Auctioneer',
      email: auctioneerEmail,
      passwordHash: 'test-only-not-for-login',
      role: UserRole.AUCTIONEER,
    },
  });

  auctioneerId = user.id;
});

afterEach(async () => {
  if (!auctioneerId) return;

  await prisma.lot.deleteMany({
    where: { auctioneerId },
  });
});

afterAll(async () => {
  try {
    await prisma.user.deleteMany({
      where: { email: auctioneerEmail },
    });
  } finally {
    await prisma.$disconnect();
  }
});

describe('Auction lot lifecycle', () => {
  it('should open a scheduled lot when its start time arrives', async () => {
    const lot = await createTestLot(LotStatus.SCHEDULED, minutesFromNow(-5), minutesFromNow(30));

    await synchronizeLotStatuses(simulatedNow);

    const updated = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updated.status).toBe(LotStatus.OPEN);
  });

  it('should close an open lot after its end time', async () => {
    const lot = await createTestLot(LotStatus.OPEN, minutesFromNow(-30), minutesFromNow(-1));

    await synchronizeLotStatuses(simulatedNow);

    const updated = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updated.status).toBe(LotStatus.CLOSED);
  });

  it('should close an expired scheduled lot without opening it', async () => {
    const lot = await createTestLot(LotStatus.SCHEDULED, minutesFromNow(-60), minutesFromNow(-30));

    const result = await synchronizeLotStatuses(simulatedNow);

    const updated = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updated.status).toBe(LotStatus.CLOSED);
    expect(result.opened).toBe(0);
  });

  it('should preserve a cancelled lot', async () => {
    const lot = await createTestLot(LotStatus.CANCELLED, minutesFromNow(-30), minutesFromNow(-1));

    await synchronizeLotStatuses(simulatedNow);

    const updated = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
    });

    expect(updated.status).toBe(LotStatus.CANCELLED);
  });
});
