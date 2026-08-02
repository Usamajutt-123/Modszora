import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { setSuggestionStatus } from '@/lib/repositories/cms';
import { fail, guardDemo, ok, parseBody, requireAdminJson } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ status: z.enum(['accepted', 'dismissed']) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminJson();
  if (denied) return denied;
  const demo = guardDemo();
  if (demo) return demo;

  const { id } = await params;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const updated = await setSuggestionStatus(id, data.status);
  if (!updated) return fail('db_error', 'Could not update the suggestion.', 500);
  return ok({ id, status: data.status });
}
