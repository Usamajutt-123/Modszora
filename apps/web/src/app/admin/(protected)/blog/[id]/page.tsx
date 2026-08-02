import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogEditor } from '@/components/admin/BlogEditor';
import { adminGetPost } from '@/lib/repositories/cms';
import { getGameOptions } from '@/lib/game-options';

export const metadata: Metadata = { title: 'Edit Blog' };
export const dynamic = 'force-dynamic';

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, games] = await Promise.all([adminGetPost(id), getGameOptions()]);
  if (!post) notFound();
  return <BlogEditor initial={post} id={post.id} games={games} isNews={post.isNews} />;
}
