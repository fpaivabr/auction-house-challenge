import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, WalletTransactionType } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { env } from '../src/config/env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const demoUsers = [
  {
    name: 'Demo Auctioneer',
    email: 'auctioneer@demo.local',
    role: UserRole.AUCTIONEER,
    balanceInCents: 0n,
  },
  {
    name: 'Demo Bidder One',
    email: 'bidder1@demo.local',
    role: UserRole.BIDDER,
    balanceInCents: 100000n,
  },
  {
    name: 'Demo Bidder Two',
    email: 'bidder2@demo.local',
    role: UserRole.BIDDER,
    balanceInCents: 100000n,
  },
];

async function main() {
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseName = databaseUrl.pathname.slice(1);

  if (
    env.NODE_ENV !== 'development' ||
    databaseName !== 'auction_house' ||
    !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
  ) {
    throw new Error('Demo seed can only run against the local auction_house development database.');
  }

  const password = process.env.DEMO_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error('DEMO_PASSWORD must contain at least 8 characters.');
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    for (const demoUser of demoUsers) {
      await tx.user.upsert({
        where: { email: demoUser.email },
        update: {},
        create: {
          name: demoUser.name,
          email: demoUser.email,
          passwordHash,
          role: demoUser.role,
          wallet: {
            create: {
              balanceInCents: demoUser.balanceInCents,
              ...(demoUser.balanceInCents > 0n
                ? {
                    transactions: {
                      create: {
                        type: WalletTransactionType.INITIAL_CREDIT,
                        amountInCents: demoUser.balanceInCents,
                      },
                    },
                  }
                : {}),
            },
          },
        },
      });

      console.log(`Demo user ready: ${demoUser.email}`);
    }
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
