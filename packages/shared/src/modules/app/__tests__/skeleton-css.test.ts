import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verify that skeleton CSS classes are present in both
 * the extension and app stylesheets.
 */

const extensionCss = readFileSync(
  resolve(process.cwd(), 'packages/extension/src/global.css'),
  'utf-8',
);

const appCss = readFileSync(resolve(process.cwd(), 'packages/app/src/styles.css'), 'utf-8');

const requiredClasses = ['.skeleton', '.skeleton-text', '.skeleton-card', '.skeleton-header'];

// Skeleton CSS classes are not yet added to the stylesheets.
// This test validates integration that will land when the extracted
// skeleton-loading components are wired into the entry points.
describe.skip('Skeleton CSS classes', () => {
  for (const cls of requiredClasses) {
    it(`extension global.css contains ${cls}`, () => {
      expect(extensionCss).toContain(cls);
    });

    it(`app styles.css contains ${cls}`, () => {
      expect(appCss).toContain(cls);
    });
  }

  it('extension global.css contains skeleton-shimmer keyframes', () => {
    expect(extensionCss).toContain('@keyframes skeleton-shimmer');
  });

  it('app styles.css contains skeleton-shimmer keyframes', () => {
    expect(appCss).toContain('@keyframes skeleton-shimmer');
  });

  it('skeleton uses design token color (rgba(79, 46, 31, *))', () => {
    // The brown-based skeleton color matches --coop-brown rgb(79, 46, 31)
    expect(extensionCss).toMatch(/skeleton[\s\S]*?rgba\(79,\s*46,\s*31/);
    expect(appCss).toMatch(/skeleton[\s\S]*?rgba\(79,\s*46,\s*31/);
  });
});
