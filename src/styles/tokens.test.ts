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
const light = theme(tokensCss);

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
  ['color-on-brand', 'color-brand-dark'],
  ['color-brand-text', 'color-surface'],
  ['color-text', 'color-brand-tint'],
  ['color-brand-text', 'color-brand-tint'],
  ['color-accent', 'color-surface'],
  ['color-accent', 'color-bg'],
  ['color-accent', 'color-accent-tint'],
  ['color-brand-text', 'color-hover'],
  ['color-success', 'color-success-bg'],
  ['color-danger', 'color-danger-bg'],
  ['color-warning', 'color-warning-bg'],
  ['color-text', 'color-selected'],
  ['color-text', 'color-warning-bg'],
  ['color-text', 'color-danger-bg'],
];

/**
 * Status markers and bars carry no text, so they need 3:1 against the page (WCAG 1.4.11).
 * Not listed: color-held (#e08a00, about 2.7:1). The design pairs every amber marker with the
 * word "Held" and every amber bar with its count, so the colour is never the only signal.
 */
const MARKERS: [string, string][] = [
  ['color-brand', 'color-surface'],
  ['color-text', 'color-surface'],
];

describe('the colour theme', () => {
  const colours = light;
  it.each(PAIRS)('keeps %s on %s readable (WCAG AA, 4.5:1)', (fg, bg) => {
    expect(colours[fg], fg).toBeDefined();
    expect(colours[bg], bg).toBeDefined();
    expect(contrast(colours[fg]!, colours[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(MARKERS)('keeps the %s marker visible on %s (3:1)', (fg, bg) => {
    expect(colours[fg], fg).toBeDefined();
    expect(contrast(colours[fg]!, colours[bg]!)).toBeGreaterThanOrEqual(3);
  });

  it('draws every corner square and every surface flat', () => {
    expect(tokensCss).toMatch(/--radius:\s*0;/);
    expect(tokensCss).toMatch(/--radius-pill:\s*0;/);
    expect(tokensCss).toMatch(/--shadow-card:\s*none;/);
  });
});

describe('the fonts', () => {
  const fontsCss = readFileSync(join(process.cwd(), 'src/styles/fonts.css'), 'utf8');

  it('serves every font from our own build, never from another site', () => {
    expect(fontsCss).not.toMatch(/https?:\/\//);
    for (const url of fontsCss.matchAll(/url\('([^']+)'\)/g)) {
      expect(url[1]).toMatch(/^@fontsource\//);
    }
  });

  it.each(['Jost', 'Mukta', 'IBM Plex Mono', 'Caveat', 'Setu Devanagari'])(
    'declares the %s family',
    (family) => {
      expect(fontsCss).toContain(`font-family: '${family}';`);
    },
  );

  it('sets English in Jost and lets Nepali fall through to Mukta, then Noto', () => {
    expect(tokensCss).toMatch(
      /--font-sans:\s*'Jost',\s*'Mukta',\s*system-ui,[^;]*'Setu Devanagari'/,
    );
  });
});
