import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './shared/database/prisma.js';
import { synchronizeLotStatuses } from './modules/lots/lots.lifecycle.js';
import { synchronizeAuditCheckpoints } from './modules/audit/audit-checkpoint.service.js';

const server = app.listen(env.PORT, () => {
  console.info(`Auction House API running on http://localhost:${env.PORT}`);
});

let auditSynchronizationRunning = false;

async function synchronizeAudit(): Promise<void> {
  const directory = env.AUDIT_CHECKPOINT_DIR;

  if (!directory || auditSynchronizationRunning) {
    return;
  }

  auditSynchronizationRunning = true;

  try {
    const result = await synchronizeAuditCheckpoints(directory);

    if (result.created > 0) {
      console.info(`Audit checkpoints synchronized: ${result.created} created.`);
    }
  } catch (error) {
    console.error('Audit checkpoint synchronization failed:', error);
  } finally {
    auditSynchronizationRunning = false;
  }
}

void synchronizeAudit();

const auditSynchronizationInterval = setInterval(() => {
  void synchronizeAudit();
}, 10_000);

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

  clearInterval(lotSynchronizationInterval);
  clearInterval(auditSynchronizationInterval);

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
