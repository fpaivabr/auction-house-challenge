import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { link, readFile, unlink, writeFile } from 'node:fs/promises';

import { env } from '../../config/env.js';

import { prisma } from '../../shared/database/prisma.js';
import { verifyAuditChain } from './audit.service.js';

type AnchorContent = {
  version: 1;
  sequence: string;
  hash: string;
};

type SignedAnchor = AnchorContent & {
  signature: string;
};

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function signAnchor(content: AnchorContent): string {
  return createHmac('sha256', env.AUDIT_SECRET)
    .update(JSON.stringify([content.version, content.sequence, content.hash]))
    .digest('hex');
}

function isValidAnchor(value: unknown): value is SignedAnchor {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const anchor = value as Record<string, unknown>;

  return (
    anchor.version === 1 &&
    typeof anchor.sequence === 'string' &&
    /^[1-9]\d*$/.test(anchor.sequence) &&
    typeof anchor.hash === 'string' &&
    HASH_PATTERN.test(anchor.hash) &&
    typeof anchor.signature === 'string' &&
    HASH_PATTERN.test(anchor.signature)
  );
}

export async function readAuditAnchor(path: string) {
  let raw: string;

  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Âncora de auditoria ausente.', { cause: error });
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Arquivo de âncora inválido.');
  }

  if (!isValidAnchor(parsed)) {
    throw new Error('Estrutura da âncora inválida.');
  }

  const expected = Buffer.from(signAnchor(parsed), 'hex');
  const actual = Buffer.from(parsed.signature, 'hex');

  if (!timingSafeEqual(expected, actual)) {
    throw new Error('Assinatura da âncora inválida.');
  }

  return {
    sequence: BigInt(parsed.sequence),
    hash: parsed.hash,
  };
}

export async function writeAuditAnchor(path: string, sequence: bigint, hash: string) {
  if (sequence < 1n || !HASH_PATTERN.test(hash)) {
    throw new Error('Dados inválidos para a âncora.');
  }

  const content: AnchorContent = {
    version: 1,
    sequence: sequence.toString(),
    hash,
  };

  const signed: SignedAnchor = {
    ...content,
    signature: signAnchor(content),
  };

  const temporaryPath = `${path}.${randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, JSON.stringify(signed, null, 2), {
      encoding: 'utf8',
      flag: 'wx',
    });

    // Cria o arquivo definitivo somente se ele ainda não existir.
    // Diferentemente de rename(), não substitui uma âncora anterior.
    await link(temporaryPath, path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new Error('A âncora já existe e não pode ser sobrescrita.', { cause: error });
    }

    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }

  return signed;
}

export async function verifyAuditAnchorAgainstChain(path: string) {
  // Uma âncora ausente ou inválida provoca erro.
  // Nunca deve ser interpretada como auditoria válida.
  const anchor = await readAuditAnchor(path);

  const chain = await verifyAuditChain();

  if (!chain.valid) {
    return {
      valid: false,
      anchoredSequence: anchor.sequence.toString(),
      error: chain.error,
    };
  }

  const anchoredEntry = await prisma.auditEntry.findUnique({
    where: { sequence: anchor.sequence },
  });

  if (!anchoredEntry) {
    return {
      valid: false,
      anchoredSequence: anchor.sequence.toString(),
      error: 'Evento ancorado não encontrado no histórico.',
    };
  }

  if (anchoredEntry.hash !== anchor.hash) {
    return {
      valid: false,
      anchoredSequence: anchor.sequence.toString(),
      error: 'Hash do evento diferente da âncora.',
    };
  }

  return {
    valid: true,
    anchoredSequence: anchor.sequence.toString(),
    error: null,
  };
}
