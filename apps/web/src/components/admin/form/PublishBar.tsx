'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarClock, ExternalLink, FileEdit, Globe, Loader2, Save } from 'lucide-react';
import type { PublishStatus } from '@modverse/shared';
import { cn } from '@/lib/utils';

/**
 * Sticky publishing bar shared by every CMS editor.
 *
 * Keeps status, scheduling and save actions reachable no matter how long the
 * form is, and surfaces the validation error count so the admin knows why the
 * publish button is disabled rather than being silently blocked.
 */

const STATUS_OPTIONS: Array<{ value: PublishStatus; label: string; icon: typeof FileEdit; tone: string }> = [
  { value: 'draft', label: 'Draft', icon: FileEdit, tone: 'text-faint' },
  { value: 'scheduled', label: 'Scheduled', icon: CalendarClock, tone: 'text-warning' },
  { value: 'published', label: 'Published', icon: Globe, tone: 'text-success' },
];

/** Converts an ISO string to the value a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PublishBar({
  status,
  onStatusChange,
  scheduledFor,
  onScheduleChange,
  onSave,
  saving,
  valid,
  previewHref,
  errorCount = 0,
}: {
  status: PublishStatus;
  onStatusChange: (s: PublishStatus) => void;
  scheduledFor: string | null;
  onScheduleChange: (v: string | null) => void;
  onSave: (status?: PublishStatus) => void | Promise<void>;
  saving: boolean;
  valid: boolean;
  previewHref?: string | null;
  errorCount?: number;
}) {
  const scheduleInvalid = status === 'scheduled' && !scheduledFor;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:left-60">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        {/* status segmented control */}
        <div
          role="radiogroup"
          aria-label="Publish status"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-1"
        >
          {STATUS_OPTIONS.map(({ value, label, icon: Icon, tone }) => {
            const active = status === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onStatusChange(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                  active ? 'bg-grad-brand text-white shadow-glow' : `${tone} hover:bg-surface`,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {status === 'scheduled' ? (
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="schedule-at" className="sr-only">
              Publish date and time
            </label>
            <input
              id="schedule-at"
              type="datetime-local"
              value={toLocalInput(scheduledFor)}
              onChange={(e) => onScheduleChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
              className={cn('input h-9 w-auto py-0 text-xs', scheduleInvalid && 'border-danger/60')}
            />
            {scheduleInvalid ? <span className="text-2xs text-danger">Pick a time</span> : null}
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {errorCount > 0 ? (
            <span className="hidden items-center gap-1.5 text-2xs text-warning sm:inline-flex">
              <AlertTriangle className="h-3.5 w-3.5" />
              {errorCount} field{errorCount === 1 ? '' : 's'} need attention
            </span>
          ) : null}

          {previewHref ? (
            <Link href={previewHref} target="_blank" className="btn-ghost btn-sm btn">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => onSave('draft')}
            disabled={saving}
            className="btn-secondary btn-sm btn"
          >
            Save draft
          </button>

          <button
            type="button"
            onClick={() => onSave()}
            disabled={saving || !valid || scheduleInvalid}
            className="btn-primary btn-sm btn"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {status === 'published' ? 'Publish' : status === 'scheduled' ? 'Schedule' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
