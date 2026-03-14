import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verify that skeleton CSS classes are present in the extension stylesheet.
 * The app (receiver PWA) does not use skeleton loading states.
 */

const extensionCss = readFileSync(
  resolve(process.cwd(), 'packages/extension/src/global.css'),
  'utf-8',
);

const requiredClasses = ['.skeleton', '.skeleton-text', '.skeleton-card', '.skeleton-header'];

describe('Skeleton CSS classes', () => {
  for (const cls of requiredClasses) {
    it(`extension global.css contains ${cls}`, () => {
      expect(extensionCss).toContain(cls);
    });
  }

  it('extension global.css contains skeleton-pulse keyframes', () => {
    expect(extensionCss).toContain('@keyframes skeleton-pulse');
  });

  it('skeleton uses design token fallback color', () => {
    expect(extensionCss).toMatch(/skeleton[\s\S]*?--coop-mist/);
  });
});
