import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Verify that the shared design tokens are the single source of truth:
 * - Both consumer CSS files import tokens.css and a11y.css from shared
 * - Neither consumer duplicates :root variables that exist in tokens.css
 */

const root = process.cwd();

const tokensCss = readFileSync(resolve(root, 'packages/shared/src/styles/tokens.css'), 'utf-8');
const a11yCss = readFileSync(resolve(root, 'packages/shared/src/styles/a11y.css'), 'utf-8');
const appCss = readFileSync(resolve(root, 'packages/app/src/styles.css'), 'utf-8');
const extCss = readFileSync(resolve(root, 'packages/extension/src/global.css'), 'utf-8');

/** Extract CSS custom property names and values declared in a :root block. */
function extractRootVarMap(css: string): Map<string, string> {
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return new Map();
  const block = rootMatch[1];
  const vars = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
    vars.set(match[1], match[2].trim());
  }
  return vars;
}

const tokenVarMap = extractRootVarMap(tokensCss);
const tokenVarNames = [...tokenVarMap.keys()];

describe('Design token single source of truth', () => {
  it('tokens.css defines at least 10 custom properties', () => {
    expect(tokenVarNames.length).toBeGreaterThanOrEqual(10);
  });

  describe('app/styles.css imports shared tokens', () => {
    it('imports tokens.css', () => {
      expect(appCss).toMatch(/@import\s+['"].*shared\/src\/styles\/tokens\.css['"]/);
    });

    it('imports a11y.css', () => {
      expect(appCss).toMatch(/@import\s+['"].*shared\/src\/styles\/a11y\.css['"]/);
    });

    it('does not redeclare token variables with identical values in :root', () => {
      const appVarMap = extractRootVarMap(appCss);
      const sameValueDuplicates = [...appVarMap.entries()]
        .filter(([name, value]) => tokenVarMap.has(name) && tokenVarMap.get(name) === value)
        .map(([name]) => name);
      expect(sameValueDuplicates).toEqual([]);
    });
  });

  describe('extension/global.css imports shared tokens', () => {
    it('imports tokens.css', () => {
      expect(extCss).toMatch(/@import\s+['"].*shared\/src\/styles\/tokens\.css['"]/);
    });

    it('imports a11y.css', () => {
      expect(extCss).toMatch(/@import\s+['"].*shared\/src\/styles\/a11y\.css['"]/);
    });

    it('does not redeclare token variables with identical values in :root', () => {
      const extVarMap = extractRootVarMap(extCss);
      const sameValueDuplicates = [...extVarMap.entries()]
        .filter(([name, value]) => tokenVarMap.has(name) && tokenVarMap.get(name) === value)
        .map(([name]) => name);
      expect(sameValueDuplicates).toEqual([]);
    });
  });
});
