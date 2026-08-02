import { GameCardSkeleton } from '@/components/ui';

/**
 * Scoped to /browse only.
 *
 * NOTE: a `loading.tsx` at the route-GROUP level wraps every child in a
 * Suspense boundary, which streams the response and flushes a 200 status
 * before a child's `notFound()` can set 404. Keep loading files on leaf
 * routes that never call notFound().
 */
export default function BrowseLoading() {
  return (
    <div className="container py-6">
      <div className="skeleton h-9 w-64 rounded-xl" />
      <div className="skeleton mt-3 h-4 w-48 rounded-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="skeleton hidden h-[600px] rounded-2xl lg:block" />
        <div className="grid grid-auto-fill gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
