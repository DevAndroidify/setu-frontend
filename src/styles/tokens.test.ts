import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read from disk: Vitest does not process CSS, so even a ?raw import comes back empty.
// (Under jsdom, import.meta.url is not a file URL; Vitest runs from the project root.)
const tokensCss = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** The colour tokens of one theme: the first :root block is light, the media block dark. */
function theme(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/--(color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}
const [lightCss = '', darkCss = ''] = tokensCss.split('@media (prefers-color-scheme: dark)');
const light = theme(lightCss);
const dark = { ...light, ...theme(darkCss) };

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Text colour on background, as the components use them. */
const PAIRS: [string, string][] = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-text-muted', 'color-bg'],
  ['color-text-muted', 'color-surface'],
  ['color-link', 'color-surface'],
  ['color-link', 'color-bg'],
  ['color-on-brand', 'color-brand'],
  ['color-success', 'color-success-bg'],
  ['color-danger', 'color-danger-bg'],
  ['color-warning', 'color-warning-bg'],
  ['color-text', 'color-selected'],
  ['color-text', 'color-warning-bg'],
  ['color-text', 'color-danger-bg'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme', (_name, colours) => {
  it.each(PAIRS)('keeps %s on %s readable (WCAG AA, 4.5:1)', (fg, bg) => {
    expect(colours[fg], fg).toBeDefined();
    expect(colours[bg], bg).toBeDefined();
    expect(contrast(colours[fg]!, colours[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});
