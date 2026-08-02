import type { GameRecord } from '@modverse/shared';
import { Gamepad2 } from 'lucide-react';
import { GameCard } from './GameCard';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';

export function GameGrid({
  games,
  priorityCount = 6,
  className,
  emptyTitle = 'No games found',
  emptyDescription = 'Try adjusting your filters or search terms.',
}: {
  games: GameRecord[];
  priorityCount?: number;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!games.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={<Gamepad2 className="h-10 w-10" />} />;
  }

  return (
    <div className={cn('grid grid-auto-fill gap-3 sm:gap-4', className)}>
      {games.map((game, i) => (
        <GameCard key={game.id ?? game.slug} game={game} priority={i < priorityCount} index={i} />
      ))}
    </div>
  );
}

/**
 * Horizontally scrolling rail used for homepage collections.
 * Snap scrolling on touch, mask fade on the right edge.
 */
export function GameRail({ games, className }: { games: GameRecord[]; className?: string }) {
  if (!games.length) return null;
  return (
    <div className={cn('-mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      <div className="scrollbar-none mask-fade-r flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4">
        {games.map((game, i) => (
          <div key={game.id ?? game.slug} className="w-[150px] shrink-0 snap-start sm:w-[168px]">
            <GameCard game={game} priority={i < 4} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GameList({ games, className }: { games: GameRecord[]; className?: string }) {
  if (!games.length) {
    return <EmptyState title="No games found" description="Try a different search." icon={<Gamepad2 className="h-10 w-10" />} />;
  }
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {games.map((game, i) => (
        <GameCard key={game.id ?? game.slug} game={game} variant="row" priority={i < 4} />
      ))}
    </div>
  );
}
