import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  readLatestAuditCheckpoint,
  saveAuditCheckpoint,
} from '../../src/modules/audit/audit-checkpoint.service.js';

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'auction-audit-checkpoints-'));
});

afterAll(async () => {
  await rm(directory, {
    recursive: true,
    force: true,
  });
});

describe('Audit checkpoints', () => {
  it('should save and retrieve the latest checkpoint', async () => {
    await saveAuditCheckpoint(directory, 1n, 'a'.repeat(64));
    await saveAuditCheckpoint(directory, 2n, 'b'.repeat(64));

    const latest = await readLatestAuditCheckpoint(directory);

    expect(latest.sequence).toBe(2n);
    expect(latest.hash).toBe('b'.repeat(64));
  });

  it('should allow an identical checkpoint to be saved again', async () => {
    const result = await saveAuditCheckpoint(directory, 2n, 'b'.repeat(64));

    expect(result.sequence).toBe(2n);
    expect(result.hash).toBe('b'.repeat(64));
  });

  it('should reject conflicting data at the same sequence', async () => {
    await expect(saveAuditCheckpoint(directory, 2n, 'c'.repeat(64))).rejects.toThrow();
  });

  it('should reject an empty checkpoint directory', async () => {
    const emptyDirectory = join(directory, 'empty');

    await expect(readLatestAuditCheckpoint(emptyDirectory)).rejects.toThrow();
  });
});
