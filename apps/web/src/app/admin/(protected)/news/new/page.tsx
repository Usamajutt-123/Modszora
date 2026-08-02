import type { Metadata } from 'next';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { getGameOptions } from '@/lib/game-options';
import type { BlogTemplate } from '@modverse/shared';

export const metadata: Metadata = { title: 'New News' };
export const dynamic = 'force-dynamic';

const firstOf = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function NewNewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const games = await getGameOptions();
  return (
    <BlogEditor
      games={games}
      isNews={true}
      presetTemplate={(firstOf(sp.template) as BlogTemplate) ?? null}
      presetTopic={firstOf(sp.topic) ?? null}
    />
  );
}
