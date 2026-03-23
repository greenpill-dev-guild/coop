import { describe, expect, test } from 'vitest';
import { scanCssContent } from '../lint-tokens';

describe('lint-tokens', () => {
  describe('border-radius detection', () => {
    test('flags simple single-value border-radius matching a token', () => {
      const violations = scanCssContent('test.css', 'button {\n  border-radius: 14px;\n}');
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        file: 'test.css',
        line: 2,
        property: 'border-radius',
        raw: '14px',
        token: 'var(--coop-radius-button)',
      });
    });

    test('flags 999px as --coop-radius-pill', () => {
      const violations = scanCssContent('a.css', '.pill { border-radius: 999px; }');
      expect(violations).toHaveLength(1);
      expect(violations[0].token).toBe('var(--coop-radius-pill)');
    });

    test('does NOT flag compound border-radius values', () => {
      const violations = scanCssContent('a.css', '.card { border-radius: 20px 20px 4px 20px; }');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag border-radius values that have no matching token', () => {
      const violations = scanCssContent('a.css', '.card { border-radius: 22px; }');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag border-radius using var() already', () => {
      const violations = scanCssContent(
        'a.css',
        '.card { border-radius: var(--coop-radius-card); }',
      );
      expect(violations).toHaveLength(0);
    });

    test('flags all matching radius token values', () => {
      const css = [
        '.a { border-radius: 6px; }',
        '.b { border-radius: 8px; }',
        '.c { border-radius: 10px; }',
        '.d { border-radius: 12px; }',
        '.e { border-radius: 16px; }',
        '.f { border-radius: 18px; }',
        '.g { border-radius: 20px; }',
        '.h { border-radius: 24px; }',
        '.i { border-radius: 28px; }',
        '.j { border-radius: 30px; }',
      ].join('\n');
      const violations = scanCssContent('a.css', css);
      expect(violations).toHaveLength(10);
    });
  });

  describe('z-index detection', () => {
    test('flags z-index matching a token value', () => {
      const violations = scanCssContent('a.css', '.header { z-index: 1; }');
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        property: 'z-index',
        raw: '1',
        token: 'var(--coop-z-sticky)',
      });
    });

    test('flags z-index: 0 as --coop-z-base', () => {
      const violations = scanCssContent('a.css', '.el { z-index: 0; }');
      expect(violations).toHaveLength(1);
      expect(violations[0].token).toBe('var(--coop-z-base)');
    });

    test('flags z-index: 100 as --coop-z-overlay', () => {
      const violations = scanCssContent('a.css', '.el { z-index: 100; }');
      expect(violations).toHaveLength(1);
      expect(violations[0].token).toBe('var(--coop-z-overlay)');
    });

    test('does NOT flag z-index values without a matching token', () => {
      const violations = scanCssContent('a.css', '.el { z-index: 5; }');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag z-index using var() already', () => {
      const violations = scanCssContent('a.css', '.el { z-index: var(--coop-z-modal); }');
      expect(violations).toHaveLength(0);
    });
  });

  describe('hex color detection', () => {
    test('flags hex color matching a palette color', () => {
      const violations = scanCssContent('a.css', '.el { color: #fcf5ef; }');
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        property: 'color',
        raw: '#fcf5ef',
        token: 'var(--coop-cream)',
      });
    });

    test('matches hex colors case-insensitively', () => {
      const violations = scanCssContent('a.css', '.el { background: #FCF5EF; }');
      expect(violations).toHaveLength(1);
      expect(violations[0].token).toBe('var(--coop-cream)');
    });

    test('flags all palette colors', () => {
      const css = [
        '.a { color: #fcf5ef; }',
        '.b { color: #4f2e1f; }',
        '.c { color: #6b4a36; }',
        '.d { color: #5a7d10; }',
        '.e { color: #fd8a01; }',
        '.f { color: #d8d4d0; }',
        '.g { color: #27140e; }',
        '.h { color: #a63b20; }',
      ].join('\n');
      const violations = scanCssContent('a.css', css);
      expect(violations).toHaveLength(8);
    });

    test('does NOT flag hex colors that are not in the palette', () => {
      const violations = scanCssContent('a.css', '.el { color: #ff0000; }');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag hex colors inside CSS comments', () => {
      const violations = scanCssContent('a.css', '/* color: #fcf5ef; */');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag hex colors that are already using var()', () => {
      const violations = scanCssContent('a.css', '.el { color: var(--coop-cream); }');
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag hex colors in CSS custom property definitions (--coop-*)', () => {
      const css = [':root {', '  --coop-cream: #fcf5ef;', '  --coop-brown: #4f2e1f;', '}'].join(
        '\n',
      );
      const violations = scanCssContent('a.css', css);
      expect(violations).toHaveLength(0);
    });

    test('does NOT flag hex colors in any custom property definition (--*)', () => {
      const violations = scanCssContent('a.css', '  --yard-dot-color: #fd8a01;');
      expect(violations).toHaveLength(0);
    });
  });

  describe('file exclusion', () => {
    test('scanCssContent works on any file name (filtering is at the file-discovery level)', () => {
      const violations = scanCssContent('tokens.css', '.el { border-radius: 14px; }');
      expect(violations).toHaveLength(1);
    });
  });

  describe('multiple violations per file', () => {
    test('detects radius, z-index, and color violations in the same file', () => {
      const css = [
        '.a { border-radius: 14px; }',
        '.b { z-index: 10; }',
        '.c { color: #5a7d10; }',
      ].join('\n');
      const violations = scanCssContent('test.css', css);
      expect(violations).toHaveLength(3);
      expect(violations[0].property).toBe('border-radius');
      expect(violations[1].property).toBe('z-index');
      expect(violations[2].property).toBe('color');
    });
  });
});
