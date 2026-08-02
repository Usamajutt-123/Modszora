import { createHash } from 'node:crypto';
import { stableStringify } from './utils.js';

/**
 * Server-only hashing helpers.
 *
 * Deliberately NOT re-exported from `index.ts`: importing `node:crypto`
 * from a module that reaches a client component would break the browser
 * bundle. Import from '@modverse/shared/hash' in server code instead.
 */

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Fingerprint of the fields that decide "did this game actually change?".
 * Used for duplicate detection and update diffing by the agent.
 *
 * Arrays are sorted so that a re-ordered screenshot list does not register
 * as a change, and text fields are trimmed/truncated to stay stable across
 * insignificant whitespace edits upstream.
 */
export function contentFingerprint(input: {
  packageName?: string | null;
  version?: string | null;
  modVersion?: string | null;
  sizeBytes?: number | null;
  whatsNew?: string | null;
  modFeatures?: string[] | null;
  screenshots?: string[] | null;
  megaUrl?: string | null;
}): string {
  return sha256(
    stableStringify({
      p: (input.packageName ?? '').toLowerCase(),
      v: (input.version ?? '').trim(),
      mv: (input.modVersion ?? '').trim(),
      s: input.sizeBytes ?? 0,
      w: (input.whatsNew ?? '').slice(0, 800).trim(),
      f: [...(input.modFeatures ?? [])].map((f) => f.trim().toLowerCase()).sort(),
      sc: [...(input.screenshots ?? [])].sort(),
      m: input.megaUrl ?? '',
    }),
  );
}
