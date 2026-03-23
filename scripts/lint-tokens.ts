#!/usr/bin/env bun

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// ── Token maps ──

const radiusTokens: Record<string, string> = {
  '999': '--coop-radius-pill',
  '14': '--coop-radius-button',
  '10': '--coop-radius-icon',
  '18': '--coop-radius-photo',
  '8': '--coop-radius-sm',
  '16': '--coop-radius-input',
  '12': '--coop-radius-chip',
  '24': '--coop-radius-card',
  '28': '--coop-radius-card-lg',
  '30': '--coop-radius-card-xl',
  '20': '--coop-radius-input-lg',
  '6': '--coop-radius-xs',
};

const zIndexTokens: Record<string, string> = {
  '0': '--coop-z-base',
  '1': '--coop-z-sticky',
  '10': '--coop-z-dropdown',
  '20': '--coop-z-tooltip',
  '25': '--coop-z-toast',
  '30': '--coop-z-modal',
  '100': '--coop-z-overlay',
};

const hexColorTokens: Record<string, string> = {
  '#fcf5ef': '--coop-cream',
  '#4f2e1f': '--coop-brown',
  '#6b4a36': '--coop-brown-soft',
  '#5a7d10': '--coop-green',
  '#fd8a01': '--coop-orange',
  '#d8d4d0': '--coop-mist',
  '#27140e': '--coop-ink',
  '#a63b20': '--coop-error',
};

// ── Types ──

export interface Violation {
  file: string;
  line: number;
  property: string;
  raw: string;
  token: string;
}

// ── Core scanning logic ──

// Matches: border-radius: <number>px;
// Must be a single value (no spaces between the number and semicolon/closing brace).
const radiusPattern = /border-radius:\s*(\d+)px\s*[;}]/g;

// Matches: z-index: <number>;
const zIndexPattern = /z-index:\s*(\d+)\s*[;}]/g;

// Matches: property: ... #hex ... ;
// Captures the property name and the hex value in context.
const hexInPropertyPattern =
  /([a-z-]+)\s*:\s*(?:(?!var\()[^;])*?(#[0-9a-fA-F]{3,6})(?:\b|[^0-9a-fA-F])/g;

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count by replacing with equal newlines
    return match.replace(/[^\n]/g, ' ');
  });
}

export function scanCssContent(file: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const stripped = stripCssComments(content);
  const lines = stripped.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check border-radius (single value only)
    for (const match of line.matchAll(radiusPattern)) {
      const value = match[1];
      const tokenName = radiusTokens[value];
      if (tokenName) {
        violations.push({
          file,
          line: lineNum,
          property: 'border-radius',
          raw: `${value}px`,
          token: `var(${tokenName})`,
        });
      }
    }

    // Check z-index
    for (const match of line.matchAll(zIndexPattern)) {
      const value = match[1];
      const tokenName = zIndexTokens[value];
      if (tokenName) {
        violations.push({
          file,
          line: lineNum,
          property: 'z-index',
          raw: value,
          token: `var(${tokenName})`,
        });
      }
    }

    // Check hex colors in CSS properties (not in var() calls, not in custom property definitions)
    for (const match of line.matchAll(hexInPropertyPattern)) {
      const property = match[1];
      const hex = match[2].toLowerCase();
      const tokenName = hexColorTokens[hex];
      if (!tokenName) continue;

      // Skip custom property definitions (--*): check if the matched property
      // is preceded by -- in the original line
      const matchIndex = match.index ?? 0;
      const before = line.slice(0, matchIndex + property.length);
      if (/--[a-z][\w-]*$/i.test(before.trimStart())) continue;

      violations.push({
        file,
        line: lineNum,
        property,
        raw: match[2],
        token: `var(${tokenName})`,
      });
    }
  }

  return violations;
}

// ── File discovery ──

const excludedFileNames = new Set(['tokens.css', 'a11y.css', 'catalog.css']);

function collectCssFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (entry.name.endsWith('.css') && !excludedFileNames.has(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files.sort();
}

// ── Main ──

function main() {
  const repoRoot = path.resolve(import.meta.dir, '..');
  const packagesDir = path.join(repoRoot, 'packages');

  const cssFiles = collectCssFiles(packagesDir);
  const allViolations: Violation[] = [];

  for (const file of cssFiles) {
    const relativePath = path.relative(repoRoot, file);
    const content = readFileSync(file, 'utf8');
    const violations = scanCssContent(relativePath, content);
    allViolations.push(...violations);
  }

  if (allViolations.length === 0) {
    console.log('\u2713 No token violations found');
    process.exit(0);
  }

  for (const v of allViolations) {
    console.log(`${v.file}:${v.line}  ${v.property}: ${v.raw} \u2192 ${v.token}`);
  }

  console.log(
    `\n${allViolations.length} token violation${allViolations.length === 1 ? '' : 's'} found.`,
  );
  process.exit(1);
}

// Only run main when executed directly (not when imported for testing)
if (import.meta.main) {
  main();
}
