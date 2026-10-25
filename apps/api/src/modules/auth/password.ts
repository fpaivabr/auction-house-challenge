import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');

  if (parts.length !== 2) {
    return false;
  }

  const [salt, originalHash] = parts;

  if (!salt || !originalHash || !/^[0-9a-f]{128}$/i.test(originalHash)) {
    return false;
  }

  const original = Buffer.from(originalHash, 'hex');
  const candidate = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return timingSafeEqual(original, candidate);
}
