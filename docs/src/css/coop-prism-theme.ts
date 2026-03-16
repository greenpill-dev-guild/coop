import type { PrismTheme } from 'prism-react-renderer';

/**
 * Custom Prism syntax-highlighting theme using the Coop earthy palette.
 *
 * Designed for light-mode only (dark switch is disabled in docusaurus.config).
 */
export const coopPrismTheme: PrismTheme = {
  plain: {
    color: '#4f2e1f', // coop-brown
    backgroundColor: '#faf5ee', // warm cream, slightly darker than page
  },
  styles: [
    // ── Comments ──
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#6b4a36', // coop-brown-soft
        fontStyle: 'italic',
      },
    },
    // ── Keywords & Tags ──
    {
      types: ['keyword', 'tag', 'important', 'atrule', 'selector'],
      style: {
        color: '#fd8a01', // coop-orange
      },
    },
    // ── Strings & Attribute Values ──
    {
      types: ['string', 'char', 'attr-value', 'template-string'],
      style: {
        color: '#5a7d10', // coop-green
      },
    },
    // ── Functions & Class Names ──
    {
      types: ['function', 'class-name'],
      style: {
        color: '#27140e', // coop-ink
        fontWeight: 'bold',
      },
    },
    // ── Numbers & Booleans ──
    {
      types: ['number', 'boolean'],
      style: {
        color: '#c46a10', // darker orange
      },
    },
    // ── Operators & Punctuation ──
    {
      types: ['operator', 'punctuation'],
      style: {
        color: '#6b4a36', // coop-brown-soft
      },
    },
    // ── Properties ──
    {
      types: ['property', 'constant', 'symbol'],
      style: {
        color: '#4f2e1f', // coop-brown
      },
    },
    // ── Variables ──
    {
      types: ['variable'],
      style: {
        color: '#4f2e1f', // coop-brown
      },
    },
    // ── Regex ──
    {
      types: ['regex'],
      style: {
        color: '#5a7d10', // coop-green
      },
    },
    // ── Attribute Names (HTML/JSX) ──
    {
      types: ['attr-name'],
      style: {
        color: '#c46a10', // darker orange
      },
    },
    // ── Built-ins ──
    {
      types: ['builtin'],
      style: {
        color: '#27140e', // coop-ink
      },
    },
    // ── Inserted / Deleted (diffs) ──
    {
      types: ['inserted'],
      style: {
        color: '#5a7d10', // coop-green
      },
    },
    {
      types: ['deleted'],
      style: {
        color: '#a63b20', // coop-error
      },
    },
  ],
};
