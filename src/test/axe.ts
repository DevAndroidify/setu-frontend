import axe from 'axe-core';

/**
 * The serious and critical WCAG problems axe-core finds in what is on screen. Colour contrast
 * is left out here because jsdom computes no styles; tokens.test.ts checks the colours.
 */
export async function a11yProblems(root: Element = document.body): Promise<string[]> {
  const results = await axe.run(root, {
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}
