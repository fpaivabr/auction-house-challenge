import { readdir } from 'node:fs/promises';

import { env } from '../../config/env.js';
import { prisma } from '../../shared/database/prisma.js';
import { saveAuditCheckpoint } from './audit-checkpoint.service.js';
import { verifyAllBidAuditConsistency } from './audit.service.js';

async function main() {
  if (process.argv[2] !== '--confirm-bootstrap') {
    throw new Error('Inicialização requer --confirm-bootstrap.');
  }

  const directory = env.AUDIT_CHECKPOINT_DIR;

  if (!directory) {
    throw new Error('AUDIT_CHECKPOINT_DIR não configurado.');
  }

  // Não recria uma âncora sobre um armazenamento já utilizado.
  const existingFiles = await readdir(directory).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  });

  if (existingFiles.length > 0) {
    throw new Error('Diretório não está vazio. Bootstrap recusado.');
  }

  const verification = await verifyAllBidAuditConsistency();

  if (!verification.valid) {
    throw new Error(verification.error ?? 'Auditoria inconsistente.');
  }

  const lastEntry = await prisma.auditEntry.findFirst({
    orderBy: { sequence: 'desc' },
  });

  if (!lastEntry) {
    throw new Error('Não existem eventos de auditoria para ancorar.');
  }

  await saveAuditCheckpoint(directory, lastEntry.sequence, lastEntry.hash);

  console.info(`Checkpoint inicial criado: sequência ${lastEntry.sequence}.`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
