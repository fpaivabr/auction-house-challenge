import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { readAuditAnchor, writeAuditAnchor } from './audit-anchor.service.js';
import { prisma } from '../../shared/database/prisma.js';
import { verifyAuditChain } from './audit.service.js';

const CHECKPOINT_PATTERN = /^audit-(\d+)\.json$/;

function checkpointPath(directory: string, sequence: bigint) {
  return join(directory, `audit-${sequence.toString()}.json`);
}

export async function saveAuditCheckpoint(directory: string, sequence: bigint, hash: string) {
  await mkdir(directory, { recursive: true });

  const path = checkpointPath(directory, sequence);

  try {
    return await writeAuditAnchor(path, sequence, hash);
  } catch (error) {
    // Uma nova tentativa pode encontrar o mesmo checkpoint
    // já gravado por outra execução.
    const existing = await readAuditAnchor(path).catch(() => null);

    if (existing?.sequence === sequence && existing.hash === hash) {
      return existing;
    }

    throw error;
  }
}

export async function readLatestAuditCheckpoint(directory: string) {
  const filenames = await readdir(directory);

  const sequences = filenames
    .map((filename) => CHECKPOINT_PATTERN.exec(filename)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(BigInt)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  if (sequences.length === 0) {
    throw new Error('Nenhum registro externo de integridade encontrado.');
  }

  const sequence = sequences[0];

  if (sequence === undefined) {
    throw new Error('Nenhum registro externo de integridade encontrado.');
  }

  return readAuditAnchor(checkpointPath(directory, sequence));
}

export async function synchronizeAuditCheckpoints(directory: string) {
  // Não gera checkpoints para uma cadeia adulterada.
  const verification = await verifyAuditChain();

  if (!verification.valid) {
    throw new Error(verification.error ?? 'Cadeia de auditoria inválida.');
  }

  // Lê os eventos confirmados em ordem.
  const entries = await prisma.auditEntry.findMany({
    orderBy: { sequence: 'asc' },
    select: {
      sequence: true,
      hash: true,
    },
  });

  // A ausência da âncora não autoriza recriá-la.
  // Inicialização e recuperação precisam ser explícitas.
  const latest = await readLatestAuditCheckpoint(directory);

  const anchoredEntry = entries.find((entry) => entry.sequence === latest.sequence);

  if (!anchoredEntry || anchoredEntry.hash !== latest.hash) {
    throw new Error(
      'Registro externo de integridade existente não corresponde ao histórico auditado.',
    );
  }

  let created = 0;

  for (const entry of entries) {
    if (entry.sequence <= latest.sequence) {
      continue;
    }

    await saveAuditCheckpoint(directory, entry.sequence, entry.hash);

    created += 1;
  }

  return {
    synchronized: true,
    created,
    latestSequence: entries.at(-1)?.sequence.toString() ?? latest.sequence.toString(),
  };
}

export async function verifyAuditCheckpoints(directory: string) {
  const chain = await verifyAuditChain();

  if (!chain.valid) {
    return {
      valid: false,
      anchoredSequence: null,
      error: chain.error,
    };
  }

  let latest: Awaited<ReturnType<typeof readLatestAuditCheckpoint>>;

  try {
    latest = await readLatestAuditCheckpoint(directory);
  } catch {
    return {
      valid: false,
      anchoredSequence: null,
      error: 'Registro externo de integridade ausente ou inválido.',
    };
  }

  const anchoredEntry = await prisma.auditEntry.findUnique({
    where: { sequence: latest.sequence },
  });

  if (!anchoredEntry || anchoredEntry.hash !== latest.hash) {
    return {
      valid: false,
      anchoredSequence: latest.sequence.toString(),
      error: 'Registro externo de integridade não corresponde ao histórico auditado.',
    };
  }

  const lastEntry = await prisma.auditEntry.findFirst({
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });

  return {
    valid: true,
    anchoredSequence: latest.sequence.toString(),
    latestSequence: lastEntry?.sequence.toString() ?? '0',
    pendingEntries: ((lastEntry?.sequence ?? 0n) - latest.sequence).toString(),
    error: null,
  };
}
