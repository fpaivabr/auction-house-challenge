import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/database/prisma.js';
import { synchronizeLotStatuses } from './modules/lots/lots.lifecycle.js';

const server = app.listen(env.PORT, () => {
  console.info(`Auction House API running on http://localhost:${env.PORT}`);
});

async function synchronizeLots(): Promise<void> {
  try {
    const result = await synchronizeLotStatuses();

    if (result.opened > 0 || result.closed > 0) {
      console.info(`Lot synchronization: ${result.opened} opened, ${result.closed} closed.`);
    }
  } catch (error) {
    console.error('Failed to synchronize lot statuses:', error);
  }
}

void synchronizeLots();

const lotSynchronizationInterval = setInterval(() => {
  void synchronizeLots();
}, 10_000);

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

clearInterval(lotSynchronizationInterval);

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
