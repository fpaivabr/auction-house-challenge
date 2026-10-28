import { LotStatus, UserRole, WalletTransactionType } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { placeBid } from '../src/modules/bids/bids.service.js';
import { listExternalProducts } from '../src/modules/products/products.service.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database/prisma.js';

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
    balanceInCents: 100_000_000n,
  },
  {
    name: 'Demo Bidder Two',
    email: 'bidder2@demo.local',
    role: UserRole.BIDDER,
    balanceInCents: 100_000_000n,
  },
];

async function main() {
  const databaseUrl = new URL(env.DATABASE_URL);
  const databaseName = databaseUrl.pathname.slice(1);

  const isLocalDevelopment =
    env.NODE_ENV === 'development' &&
    databaseName === 'auction_house' &&
    ['localhost', '127.0.0.1'].includes(databaseUrl.hostname);

  const isAuthorizedProductionSeed =
    env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED === 'true';

  if (!isLocalDevelopment && !isAuthorizedProductionSeed) {
    throw new Error(
      'Seed permitido apenas no banco local de desenvolvimento ou mediante autorização explícita em produção.',
    );
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

  // Localiza os usuários sem alterar suas senhas ou seus saldos atuais.
  const auctioneer = await prisma.user.findUniqueOrThrow({
    where: { email: 'auctioneer@demo.local' },
    select: { id: true },
  });

  const bidder = await prisma.user.findUniqueOrThrow({
    where: { email: 'bidder1@demo.local' },
    select: { id: true },
  });

  // Identificador estável para evitar duplicar o lote ao repetir o seed.
  const demoSource = 'demo-seed';
  const demoItemId = 'verzel-published-lot-001';

  let lot = await prisma.lot.findFirst({
    where: {
      auctioneerId: auctioneer.id,
      externalSource: demoSource,
      externalItemId: demoItemId,
    },
  });

  if (!lot) {
    let title = 'Paisagem demonstrativa';
    let description = 'Obra ilustrativa para demonstração da plataforma de leilões.';
    let imageUrl: string | null = null;

    // Prefere uma obra real de domínio público do acervo integrado.
    // Mantém um exemplo funcional caso a API externa esteja indisponível.
    try {
      const result = await listExternalProducts('landscape');
      const artwork = result.products[0];

      if (artwork) {
        title = artwork.title;
        description = artwork.description;
        imageUrl = artwork.thumbnail;
      }
    } catch {
      console.warn('Acervo externo indisponível. Usando o lote demonstrativo sem imagem.');
    }

    const now = Date.now();

    lot = await prisma.lot.create({
      data: {
        auctioneerId: auctioneer.id,
        externalSource: demoSource,
        externalItemId: demoItemId,
        title,
        description,
        imageUrl,
        initialPriceInCents: 25_000_000n,
        minimumIncrementInCents: 1_000_000n,
        status: LotStatus.OPEN,
        startsAt: new Date(now - 5 * 60 * 1000),
        endsAt: new Date(now + 72 * 60 * 60 * 1000),
      },
    });

    console.info(`Lote demonstrativo publicado: ${lot.id}`);
  } else {
    console.info(`Lote demonstrativo já existente: ${lot.id}`);
  }

  // Nunca cria um lance duplicado ao executar o seed novamente.
  const existingBids = await prisma.bid.count({
    where: { lotId: lot.id },
  });

  if (existingBids === 0) {
    // Usa o serviço oficial: cria lance, reserva e auditoria.
    await placeBid({
      lotId: lot.id,
      bidderId: bidder.id,
      amountInCents: 27_500_000n,
    });

    console.info('Lance demonstrativo registrado: R$ 275.000,00.');
  } else {
    console.info('O lote demonstrativo já possui lances.');
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
