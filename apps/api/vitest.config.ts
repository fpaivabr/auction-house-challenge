import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '.env.test', override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não configurada para testes.');
}

const databaseName = new URL(databaseUrl).pathname.slice(1);

if (databaseName !== 'auction_house_test') {
  throw new Error('Os testes de integração exigem o banco auction_house_test.');
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
  },
});
