import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

config({ path: '.env.test', override: true });

export default async function setup() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL não configurada para testes.');
  }

  const url = new URL(databaseUrl);

  if (
    url.pathname.slice(1) !== 'auction_house_test' ||
    !['localhost', '127.0.0.1'].includes(url.hostname)
  ) {
    throw new Error('A limpeza exige o banco local auction_house_test.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl,
    }),
  });

  async function cleanTestDatabase() {
    // Remove somente os dados das tabelas da aplicação
    // no banco exclusivo de testes.
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "AuditEntry",
        "Receipt",
        "Settlement",
        "WalletTransaction",
        "WalletHold",
        "Bid",
        "Lot",
        "Wallet",
        "User"
      RESTART IDENTITY CASCADE
    `);
  }

  // Garante que nenhum dado de uma execução anterior interfira.
  try {
    await cleanTestDatabase();
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }

  // O Vitest executa essa função após terminar a suíte.
  return async () => {
    try {
      await cleanTestDatabase();
    } finally {
      await prisma.$disconnect();
    }
  };
}
