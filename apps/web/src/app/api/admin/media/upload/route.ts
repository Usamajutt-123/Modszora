import { type NextRequest } from 'next/server';
import sharp from 'sharp';
import { slugify } from '@modverse/shared';
import { getAdminClient } from '@/lib/supabase/server';
import { indexMedia } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'];

/**
 * Image upload endpoint used by every admin form and the media library.
 *
 * Uploads are normalised through Sharp before they reach storage: EXIF
 * rotation applied, oversized images capped, and everything converted to
 * WebP. This means a 6 MB phone screenshot becomes a ~200 KB asset and the
 * public site never serves an unoptimised original.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const db = getAdminClient();
  if (!db) return fail('not_configured', 'Storage is not configured.', 503);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail('bad_request', 'Expected multipart/form-data.', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return fail('no_file', 'No file was provided.', 400);
  if (file.size > MAX_BYTES) return fail('too_large', `File exceeds the ${MAX_BYTES / 1048576} MB limit.`, 413);
  if (!ACCEPTED.includes(file.type)) {
    return fail('bad_type', `Unsupported type "${file.type}". Use PNG, JPEG, WebP, AVIF or GIF.`, 415);
  }

  const folder = String(form.get('folder') ?? 'uploads');
  const ownerSlug = form.get('ownerSlug') ? String(form.get('ownerSlug')) : null;
  const maxWidth = Number(form.get('maxWidth') ?? 2560);

  const input = Buffer.from(await file.arrayBuffer());

  let processed: Buffer;
  let width: number | null = null;
  let height: number | null = null;

  try {
    const pipeline = sharp(input, { failOn: 'none', animated: false }).rotate();
    const meta = await pipeline.metadata();

    const resized =
      meta.width && meta.width > maxWidth
        ? pipeline.resize({ width: maxWidth, withoutEnlargement: true })
        : pipeline;

    const result = await resized.webp({ quality: 86, effort: 5 }).toBuffer({ resolveWithObject: true });
    processed = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch (err) {
    return fail('processing_failed', `Could not process the image: ${err instanceof Error ? err.message : err}`, 422);
  }

  const baseName = slugify(file.name.replace(/\.[^.]+$/, '') || 'upload', { maxLength: 60 });
  // Timestamp suffix avoids clobbering an existing asset with the same name.
  const name = `${baseName}-${Date.now().toString(36)}.webp`;
  const path = ownerSlug ? `${folder}/${slugify(ownerSlug)}/${name}` : `${folder}/${name}`;

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'modverse';
  const { error: uploadError } = await db.storage.from(bucket).upload(path, processed, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '31536000',
  });
  if (uploadError) return fail('upload_failed', uploadError.message, 500);

  const { data: pub } = db.storage.from(bucket).getPublicUrl(path);

  await indexMedia({
    path,
    name,
    url: pub.publicUrl,
    bytes: processed.byteLength,
    width,
    height,
    ownerSlug,
  });

  return ok(
    {
      url: pub.publicUrl,
      path,
      name,
      bytes: processed.byteLength,
      width,
      height,
      format: 'webp',
      savedBytes: Math.max(0, input.byteLength - processed.byteLength),
    },
    201,
  );
}
