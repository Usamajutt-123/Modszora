import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReviewEditor } from '@/components/admin/ReviewEditor';
import { adminGetReview } from '@/lib/repositories/cms';
import { getGameOptions } from '@/lib/game-options';

export const metadata: Metadata = { title: 'Edit Review' };
export const dynamic = 'force-dynamic';

export default async function EditReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [review, games] = await Promise.all([adminGetReview(id), getGameOptions()]);
  if (!review) notFound();
  return <ReviewEditor initial={review} id={review.id} games={games} />;
}
