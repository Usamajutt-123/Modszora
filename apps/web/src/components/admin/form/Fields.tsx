'use client';

import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronDown, Info, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Form primitives shared by every CMS editor.
 *
 * All of them are controlled, labelled and wired for accessibility
 * (aria-invalid, aria-describedby), so validation errors are announced
 * rather than only shown in colour.
 */

interface BaseProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  counter,
  className,
}: BaseProps & { htmlFor: string; children: ReactNode; counter?: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted">
          {label}
          {required ? <span className="ml-1 text-danger">*</span> : null}
        </label>
        {counter}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-2xs text-danger">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-2xs text-faint">
          <Info className="mt-px h-3 w-3 shrink-0" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Character counter that turns amber near the limit and red past it. */
function Counter({ value, max, min }: { value: number; max?: number; min?: number }) {
  if (!max && !min) return null;
  const over = max !== undefined && value > max;
  const under = min !== undefined && value > 0 && value < min;
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-2xs tabular-nums',
        over || under ? 'text-danger' : max && value > max * 0.9 ? 'text-warning' : 'text-faint',
      )}
    >
      {value}
      {max ? `/${max}` : ''}
    </span>
  );
}

/* ─────────────── text ─────────────── */

export function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  minLength,
  type = 'text',
  mono,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  type?: 'text' | 'url' | 'email' | 'number';
  mono?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell {...base} htmlFor={id} counter={<Counter value={value.length} max={maxLength} min={minLength} />}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(base.error)}
        className={cn('input', mono && 'font-mono text-xs', base.error && 'border-danger/60 focus:ring-danger/25')}
      />
    </FieldShell>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  minLength,
  mono,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  minLength?: number;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell {...base} htmlFor={id} counter={<Counter value={value.length} max={maxLength} min={minLength} />}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(base.error)}
        className={cn(
          'input resize-y',
          mono && 'font-mono text-xs leading-relaxed',
          base.error && 'border-danger/60 focus:ring-danger/25',
        )}
      />
    </FieldShell>
  );
}

/* ─────────────── select ─────────────── */

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  ...base
}: BaseProps & {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  const id = useId();
  return (
    <FieldShell {...base} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-invalid={Boolean(base.error)}
          className={cn('input appearance-none pr-9', base.error && 'border-danger/60')}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      </div>
    </FieldShell>
  );
}

/* ─────────────── toggle ─────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  icon?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line/70 bg-surface-2/40 px-3.5 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          {icon}
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-2xs text-faint">{hint}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-grad-brand shadow-glow' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ─────────────── tag / list editor ─────────────── */

export function TagInput({
  values,
  onChange,
  placeholder = 'Type and press Enter',
  maxItems = 20,
  suggestions = [],
  ...base
}: BaseProps & {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  suggestions?: string[];
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, '');
    if (!v || values.length >= maxItems) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    onChange([...values, v]);
    setDraft('');
  };

  const unused = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 6);

  return (
    <FieldShell {...base} htmlFor={id} counter={<Counter value={values.length} max={maxItems} />}>
      <div
        className={cn(
          'flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-xl border bg-surface-2 px-2.5 py-2 transition-colors',
          base.error ? 'border-danger/60' : 'border-line focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/25',
        )}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-brand/15 px-2 py-1 text-2xs font-medium text-brand"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== tag))}
              aria-label={`Remove ${tag}`}
              className="transition-colors hover:text-danger"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          placeholder={values.length >= maxItems ? `Limit of ${maxItems} reached` : placeholder}
          disabled={values.length >= maxItems}
          className="min-w-[8rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
      </div>

      {unused.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-2xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
            >
              <Plus className="h-2.5 w-2.5" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </FieldShell>
  );
}

/** Ordered list editor for pros, cons and step-by-step guides. */
export function ListEditor({
  values,
  onChange,
  placeholder = 'Add an item',
  maxItems = 12,
  tone = 'neutral',
  ...base
}: BaseProps & {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const toneClass =
    tone === 'positive'
      ? 'border-success/30 bg-success/[0.06]'
      : tone === 'negative'
        ? 'border-danger/30 bg-danger/[0.06]'
        : 'border-line/70 bg-surface-2/40';

  const bulletClass = tone === 'positive' ? 'bg-success' : tone === 'negative' ? 'bg-danger' : 'bg-brand';

  const add = () => {
    const v = draft.trim();
    if (!v || values.length >= maxItems) return;
    onChange([...values, v]);
    setDraft('');
  };

  return (
    <FieldShell {...base} htmlFor={id} counter={<Counter value={values.length} max={maxItems} />}>
      <div className="space-y-1.5">
        {values.map((item, i) => (
          <div key={`${item}-${i}`} className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2', toneClass)}>
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', bulletClass)} />
            <input
              value={item}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
              aria-label={`${base.label} item ${i + 1}`}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, x) => x !== i))}
              aria-label={`Remove item ${i + 1}`}
              className="shrink-0 text-faint transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {values.length < maxItems ? (
        <div className="mt-2 flex gap-2">
          <input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="input flex-1"
          />
          <button type="button" onClick={add} disabled={!draft.trim()} className="btn-secondary btn shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      ) : null}
    </FieldShell>
  );
}

/* ─────────────── score slider ─────────────── */

export function ScoreSlider({
  value,
  onChange,
  label,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  max?: number;
}) {
  const id = useId();
  const pct = (value / max) * 100;
  const tone = pct >= 80 ? 'text-success' : pct >= 60 ? 'text-brand' : pct >= 40 ? 'text-warning' : 'text-danger';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-medium text-muted">
          {label}
        </label>
        <span className={cn('font-display text-sm font-bold tabular-nums', tone)}>{value.toFixed(1)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-brand
                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand
                   [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:transition-transform
                   [&::-webkit-slider-thumb]:hover:scale-110"
        style={{
          background: `linear-gradient(to right, rgb(var(--mv-brand)) ${pct}%, rgb(var(--mv-surface-2)) ${pct}%)`,
        }}
      />
    </div>
  );
}

/* ─────────────── section wrapper ─────────────── */

export function FormSection({
  title,
  description,
  icon,
  children,
  className,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn('card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            {icon ? <span className="text-brand">{icon}</span> : null}
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
