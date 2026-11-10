import type { MappingSpec, PreviewRow } from '../mappings/api';
import { valueKey } from '../mappings/spec';
import type { QuarantineEntry } from '../quarantine/api';
import type { BatchStage, RunDetail } from './api';
import { rowsSettled } from './status';

/** The columns of the stage strip. Reconcile runs once, after the last batch is loaded. */
export type StageColumn = 'extract' | 'transform' | 'validate' | 'match' | 'load' | 'reconcile';
export type StageState = 'done' | 'now' | 'following' | 'waiting' | 'afterLoad';
export type StageProgress = { stage: StageColumn; done: number; total: number; state: StageState };

const ORDER: BatchStage[] = ['extract', 'transform', 'validate', 'match', 'load', 'done'];

/**
 * Batches done out of total for each stage. The backend reports where each batch is now, so a
 * batch has finished every stage before that one. Dry runs stop after validating.
 */
export function stageProgress(run: RunDetail): StageProgress[] {
  const batches = run.progress.batches;
  const count = (s: BatchStage) => batches[s] ?? 0;
  const total = ORDER.reduce((sum, s) => sum + count(s), 0);
  const stages: (BatchStage & StageColumn)[] =
    run.mode === 'dry_run'
      ? ['extract', 'transform', 'validate']
      : ['extract', 'transform', 'validate', 'match', 'load'];
  // The earliest stage that still holds batches is the one being worked on now.
  const current = stages.find((s) => count(s) > 0);

  const columns: StageProgress[] = stages.map((stage) => {
    const at = ORDER.indexOf(stage);
    const done = ORDER.slice(at + 1).reduce((sum, s) => sum + count(s), 0);
    let state: StageState = 'waiting';
    if (total > 0 && done === total) state = 'done';
    else if (stage === current) state = 'now';
    else if (done > 0 || count(stage) > 0) state = 'following';
    return { stage, done, total, state };
  });
  if (run.mode === 'production') {
    const finished = run.status === 'completed';
    columns.push({
      stage: 'reconcile',
      done: finished ? total : 0,
      total,
      state: finished ? 'done' : 'afterLoad',
    });
  }
  return columns;
}

export type RowPart = { kind: 'loaded' | 'linked' | 'passed' | 'held' | 'review'; value: number };

/** Where the rows of the file went so far, and how many are still to go. */
export function rowSplit(run: RunDetail): { total: number; parts: RowPart[]; toGo: number } {
  const p = run.progress;
  const total = run.counts.total ?? run.file.rowCount ?? 0;
  const parts: RowPart[] =
    run.mode === 'production'
      ? [
          { kind: 'loaded', value: p.loaded },
          { kind: 'linked', value: p.linked },
          { kind: 'held', value: p.quarantined },
          { kind: 'review', value: p.duplicate_review },
        ]
      : [
          { kind: 'passed', value: p.valid },
          { kind: 'held', value: p.quarantined },
        ];
  return { total, parts, toGo: Math.max(0, total - rowsSettled(run)) };
}

/**
 * A reason without the value it is about, so "2045-13-04 is not a real BS date" and
 * "2046-14-01 is not a real BS date" count as one problem. The step name prefix goes too.
 */
export function reasonText(message: string): string {
  return message
    .replace(/^\w+:\s*/, '')
    .replace(/^("[^"]*"|\S+)\s+(?=(is|matches|does|has)\b)/, '')
    .trim();
}

export type ReasonGroup = { field: string; message: string; count: number };

/** Held rows' reasons grouped by field and message, most common first. */
export function heldReasons(entries: Pick<QuarantineEntry, 'reasons'>[]): ReasonGroup[] {
  const groups = new Map<string, ReasonGroup>();
  for (const entry of entries) {
    for (const r of entry.reasons) {
      const message = reasonText(r.message);
      const key = `${r.field}\u0000${message}`;
      const group = groups.get(key) ?? { field: r.field, message, count: 0 };
      group.count += 1;
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
}

export const FIX_KINDS = ['preetiToUnicode', 'bsToAd', 'vdcToLocalUnit'] as const;
export type FixKind = (typeof FIX_KINDS)[number];
export type FixExample = { kind: FixKind; before: string; after: string };

/**
 * One before → after for each kind of fix this run's mapping makes, taken from rows of its
 * file: the legacy columns a field reads, and the value Setu made of them.
 */
export function fixExamples(spec: MappingSpec, rows: PreviewRow[]): FixExample[] {
  const examples: FixExample[] = [];
  for (const kind of FIX_KINDS) {
    const field = spec.fields.find((f) => f.transforms.some((t) => t.name === kind));
    if (!field) continue;
    const key = valueKey(field.target);
    for (const row of rows) {
      const before = field.from
        .map((c) => row.raw[c]?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      const after = row.values[key];
      if (before && after && after !== before) {
        examples.push({ kind, before, after });
        break;
      }
    }
  }
  return examples;
}
