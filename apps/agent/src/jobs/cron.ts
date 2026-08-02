import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config/index.js';
import { createLogger } from '../core/logger.js';
import { queue } from '../core/queue.js';

const log = createLogger('cron');

interface CronDef {
  name: string;
  expression: string;
  enabled: boolean;
  task?: ScheduledTask;
  lastRun: string | null;
  run: () => void;
}

const definitions: CronDef[] = [
  {
    name: 'discovery',
    expression: config.CRON_DISCOVERY,
    enabled: true,
    lastRun: null,
    run: () => {
      queue.enqueue({
        type: 'discovery',
        payload: { limitPerSource: 15, autoIngest: config.AGENT_AUTO_PUBLISH },
        priority: 5,
        dedupe: false,
      });
    },
  },
  {
    name: 'update-check',
    expression: config.CRON_UPDATES,
    enabled: true,
    lastRun: null,
    run: () => {
      queue.enqueue({ type: 'update-check', payload: { limit: 40, autoApply: true }, priority: 7, dedupe: false });
    },
  },
  {
    name: 'recommendations',
    expression: config.CRON_RECOMMENDATIONS,
    enabled: true,
    lastRun: null,
    run: () => {
      queue.enqueue({ type: 'recommendation', payload: { limitPerSource: 12 }, priority: 3, dedupe: false });
    },
  },
];

/** Rough "next run" estimate — node-cron does not expose one. */
function estimateNextRun(expression: string): string | null {
  if (!cron.validate(expression)) return null;
  const parts = expression.trim().split(/\s+/);
  const now = new Date();
  const next = new Date(now.getTime() + 60_000);
  next.setSeconds(0, 0);

  // Walk forward minute by minute for up to 8 days.
  for (let i = 0; i < 60 * 24 * 8; i += 1) {
    if (matchesCron(parts, next)) return next.toISOString();
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [range, stepRaw] = part.split('/');
      const step = Number(stepRaw);
      if (!Number.isFinite(step) || step <= 0) continue;
      if (range === '*' || range === '') {
        if (value % step === 0) return true;
      } else if (range?.includes('-')) {
        const [a, b] = range.split('-').map(Number);
        if (a !== undefined && b !== undefined && value >= a && value <= b && (value - a) % step === 0) return true;
      }
      continue;
    }
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (a !== undefined && b !== undefined && value >= a && value <= b) return true;
      continue;
    }
    if (Number(part) === value) return true;
  }
  return false;
}

function matchesCron(parts: string[], date: Date): boolean {
  const [min = '*', hour = '*', dom = '*', month = '*', dow = '*'] = parts;
  return (
    fieldMatches(min, date.getMinutes()) &&
    fieldMatches(hour, date.getHours()) &&
    fieldMatches(dom, date.getDate()) &&
    fieldMatches(month, date.getMonth() + 1) &&
    fieldMatches(dow, date.getDay())
  );
}

export function startCrons(): void {
  if (!config.CRON_ENABLED) {
    log.info('cron scheduling disabled (set CRON_ENABLED=true to enable)');
    return;
  }

  for (const def of definitions) {
    if (!cron.validate(def.expression)) {
      log.error(`invalid cron expression for ${def.name}: "${def.expression}"`);
      def.enabled = false;
      continue;
    }
    def.task = cron.schedule(
      def.expression,
      () => {
        def.lastRun = new Date().toISOString();
        log.info(`cron fired: ${def.name}`);
        try {
          def.run();
        } catch (err) {
          log.error(`cron ${def.name} failed to enqueue: ${err instanceof Error ? err.message : err}`);
        }
      },
      { scheduled: true, timezone: 'UTC' },
    );
    log.info(`scheduled ${def.name} — ${def.expression} (next ≈ ${estimateNextRun(def.expression) ?? 'unknown'})`);
  }
}

export function stopCrons(): void {
  for (const def of definitions) {
    def.task?.stop();
    def.task = undefined;
  }
  log.info('crons stopped');
}

export function cronStatus(): Array<{ name: string; expression: string; nextRun: string | null; enabled: boolean }> {
  return definitions.map((d) => ({
    name: d.name,
    expression: d.expression,
    nextRun: config.CRON_ENABLED && d.enabled ? estimateNextRun(d.expression) : null,
    enabled: config.CRON_ENABLED && d.enabled,
  }));
}

/** Manually fire a cron definition (used by the dashboard "Run now" button). */
export function triggerCron(name: string): boolean {
  const def = definitions.find((d) => d.name === name);
  if (!def) return false;
  def.lastRun = new Date().toISOString();
  def.run();
  return true;
}
