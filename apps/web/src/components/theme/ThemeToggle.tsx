'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme, type ThemeMode } from './ThemeProvider';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ mode: ThemeMode; icon: typeof Sun; label: string }> = [
  { mode: 'light', icon: Sun, label: 'Light theme' },
  { mode: 'dark', icon: Moon, label: 'Dark theme' },
  { mode: 'system', icon: Monitor, label: 'Follow system theme' },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn('relative inline-flex items-center gap-0.5 rounded-full bg-surface-2 p-1 border border-line/70', className)}
    >
      {OPTIONS.map(({ mode, icon: Icon, label }) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(mode)}
            className={cn(
              'relative grid h-7 w-7 place-items-center rounded-full transition-colors duration-200',
              active ? 'text-white' : 'text-faint hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full bg-grad-brand shadow-glow"
              />
            )}
            <Icon className="relative z-10 h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
