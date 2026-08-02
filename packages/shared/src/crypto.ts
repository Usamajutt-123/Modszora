import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * AES-256-GCM envelope encryption for secrets stored in Postgres
 * (API keys entered through the admin Settings screen).
 *
 * Format: v1.<iv-b64>.<tag-b64>.<ciphertext-b64>
 */

const VERSION = 'v1';
const IV_BYTES = 12;

function deriveKey(secret: string): Buffer {
  if (!secret || secret.length < 16) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be at least 16 characters.');
  }
  // Accept raw 32-byte hex/base64 keys, otherwise derive deterministically.
  if (/^[0-9a-f]{64}$/i.test(secret)) return Buffer.from(secret, 'hex');
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string, secret: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed encrypted payload.');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64 as string, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64 as string, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64 as string, 'base64')), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(`${VERSION}.`) && value.split('.').length === 4;
}

/** Constant-time comparison for API keys / webhook secrets. */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a ?? '', 'utf8');
  const bufB = Buffer.from(b ?? '', 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn the comparison to avoid trivial length oracle.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function maskSecret(value: string | null | undefined, visible = 4): string {
  if (!value) return '';
  if (value.length <= visible * 2) return '•'.repeat(value.length);
  return `${value.slice(0, visible)}${'•'.repeat(Math.max(6, value.length - visible * 2))}${value.slice(-visible)}`;
}

export function generateApiKey(prefix = 'mv'): string {
  return `${prefix}_${randomBytes(28).toString('base64url')}`;
}
