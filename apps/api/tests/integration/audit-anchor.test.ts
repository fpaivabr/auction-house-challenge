import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readAuditAnchor, writeAuditAnchor } from '../../src/modules/audit/audit-anchor.service.js';

let directory: string;
let anchorPath: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'auction-audit-'));
  anchorPath = join(directory, 'anchor.json');
});

afterAll(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('External audit anchor', () => {
  it('should write and read a signed anchor', async () => {
    const hash = randomBytes(32).toString('hex');

    await writeAuditAnchor(anchorPath, 5n, hash);

    const anchor = await readAuditAnchor(anchorPath);

    expect(anchor.sequence).toBe(5n);
    expect(anchor.hash).toBe(hash);
  });

  it('should detect changes to the anchored hash', async () => {
    const original = await readFile(anchorPath, 'utf8');
    const modified = JSON.parse(original) as {
      hash: string;
    };

    modified.hash = randomBytes(32).toString('hex');

    try {
      await writeFile(anchorPath, JSON.stringify(modified));

      await expect(readAuditAnchor(anchorPath)).rejects.toThrow('Assinatura da âncora inválida.');
    } finally {
      await writeFile(anchorPath, original);
    }
  });

  it('should fail when the anchor does not exist', async () => {
    await expect(readAuditAnchor(join(directory, 'missing.json'))).rejects.toThrow(
      'Âncora de auditoria ausente.',
    );
  });

  it('should reject invalid anchor sequences', async () => {
    await expect(writeAuditAnchor(anchorPath, 0n, randomBytes(32).toString('hex'))).rejects.toThrow(
      'Dados inválidos para a âncora.',
    );
  });
});
