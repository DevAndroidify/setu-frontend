import type { ColumnProfile } from './api';
import { columnFlags, formatBytes } from './format';

const column = (over: Partial<ColumnProfile> = {}): ColumnProfile => ({
  name: 'NAAM',
  filled: 100,
  empty: 0,
  emptyPct: 0,
  distinct: 80,
  distinctCapped: false,
  topValues: [],
  length: { min: 3, max: 20 },
  patterns: [{ pattern: 'a a', count: 100 }],
  preeti: { share: 0, likely: false },
  dateFormats: [],
  numeric: null,
  ...over,
});

describe('columnFlags', () => {
  it('flags nothing in a clean column', () => {
    expect(columnFlags(column())).toEqual([]);
  });

  it('flags Preeti text, mixed date formats and Devanagari digits', () => {
    const texts = columnFlags(
      column({
        preeti: { share: 0.97, likely: true },
        dateFormats: [
          { format: 'YYYY/M/D', count: 60 },
          { format: 'D/M/YYYY', count: 40 },
        ],
        patterns: [{ pattern: '९९९९/९/९', count: 30 }],
      }),
    ).map((f) => f.text);
    expect(texts).toEqual([
      'Preeti font text: convert to Unicode',
      '2 date formats mixed',
      'Devanagari digits',
    ]);
  });

  it('warns about a partly empty column and alarms about a mostly empty one', () => {
    expect(columnFlags(column({ emptyPct: 12 }))).toEqual([{ tone: 'warning', text: '12% empty' }]);
    expect(columnFlags(column({ emptyPct: 75 }))).toEqual([{ tone: 'danger', text: '75% empty' }]);
  });
});

describe('formatBytes', () => {
  it('uses the largest sensible unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(10_227_923)).toBe('9.8 MB');
  });
});
