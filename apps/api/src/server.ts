import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/database/prisma.js';

const server = app.listen(env.PORT, () => {
  console.info(`Auction House API running on http://localhost:${env.PORT}`);
});

let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  server.close(async (error) => {
    try {
      await prisma.$disconnect();

      if (error) {
        console.error('Failed to close HTTP server:', error);
        process.exitCode = 1;
      }
    } catch (disconnectError) {
      console.error('Failed to disconnect database:', disconnectError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
