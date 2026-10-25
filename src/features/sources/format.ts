import type { ColumnProfile } from './api';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

export const formatNumber = (n: number): string => n.toLocaleString('en-IN');

export type ColumnFlag = { tone: 'warning' | 'danger'; text: string };

/**
 * What a mapping will have to deal with in this column, read from the profile. Pure, so the
 * rules are tested on their own.
 */
export function columnFlags(column: ColumnProfile): ColumnFlag[] {
  const flags: ColumnFlag[] = [];
  if (column.preeti.likely) {
    flags.push({ tone: 'warning', text: 'Preeti font text: convert to Unicode' });
  }
  if (column.dateFormats.length > 1) {
    flags.push({ tone: 'warning', text: `${column.dateFormats.length} date formats mixed` });
  }
  if (column.patterns.some((p) => p.pattern.includes('९'))) {
    flags.push({ tone: 'warning', text: 'Devanagari digits' });
  }
  if (column.emptyPct >= 50) {
    flags.push({ tone: 'danger', text: `${column.emptyPct}% empty` });
  } else if (column.emptyPct >= 10) {
    flags.push({ tone: 'warning', text: `${column.emptyPct}% empty` });
  }
  return flags;
}
