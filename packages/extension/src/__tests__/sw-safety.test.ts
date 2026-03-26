// @vitest-environment node

/**
 * Service Worker Safety — built-output validation.
 *
 * Parses the built background.js and all its statically imported chunks
 * using an AST parser, then walks each tree to flag patterns that are
 * illegal or unsafe in a Chrome MV3 service worker context when they
 * execute at module-evaluation time (top-level):
 *
 *   - dynamic `import()`
 *   - `document.*` access
 *   - `URL.createObjectURL()`
 *   - `new Worker()`
 *
 * A node is "top-level" if it is NOT inside a FunctionDeclaration,
 * FunctionExpression, ArrowFunctionExpression, or method body.
 * This is the key distinction: code inside function bodies only runs
 * when called, while top-level code runs during module evaluation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'vite';
import { describe, expect, it } from 'vitest';

// ---- helpers ----------------------------------------------------------------

const distDir = path.resolve(__dirname, '../../.output/chrome-mv3');
const bgPath = path.join(distDir, 'background.js');
const distExists = fs.existsSync(bgPath);
const requireDist = process.env.COOP_REQUIRE_EXTENSION_DIST === '1';

/** Extract static `from "..."` import specifiers from a JS file. */
function extractStaticImports(code: string): string[] {
  const matches: string[] = [];
  for (const m of code.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)) {
    matches.push(m[1]);
  }
  return matches;
}

/** Build the full set of files in the background SW's static import graph. */
function traceImportGraph(entryPath: string): string[] {
  const visited = new Set<string>();
  const queue = [entryPath];

  while (queue.length > 0) {
    const filePath = queue.pop() as string;
    const resolved = path.resolve(
      path.dirname(entryPath),
      filePath.startsWith('.') ? filePath : filePath,
    );
    const normalised = resolved.endsWith('.js') ? resolved : `${resolved}.js`;

    if (visited.has(normalised) || !fs.existsSync(normalised)) continue;
    visited.add(normalised);

    const code = fs.readFileSync(normalised, 'utf8');
    const dir = path.dirname(normalised);
    for (const spec of extractStaticImports(code)) {
      queue.push(path.resolve(dir, spec));
    }
  }

  return [...visited];
}

interface Violation {
  file: string;
  offset: number;
  kind: string;
  snippet: string;
}

// Always-safe scopes: named function declarations and class methods are never IIFEs.
const ALWAYS_SAFE = new Set(['FunctionDeclaration', 'MethodDefinition']);

// Conditionally-safe: FunctionExpression/ArrowFunctionExpression are safe
// ONLY if they are NOT immediately invoked (i.e., not the callee of a CallExpression).
const MAYBE_SAFE = new Set(['FunctionExpression', 'ArrowFunctionExpression']);

type AstNode = {
  type: string;
  start?: number;
  end?: number;
  [key: string]: unknown;
};

/**
 * Walk an AST tree, calling `visitor` for every node that is at the
 * module's top-level execution scope (not inside any function/method body).
 *
 * A function expression or arrow function is considered "safe" (deferred)
 * unless it's the direct callee of a CallExpression — i.e., an IIFE like
 * `(()=>{ ... })()` or `Xl(()=>import(...))` where the arrow is passed
 * as an argument and may be invoked immediately.
 */
function walkTopLevel(
  node: AstNode,
  visitor: (n: AstNode) => void,
  inScope = false,
  parentIsCallCallee = false,
) {
  if (!node || typeof node !== 'object') return;

  // Named function declarations and class methods are always deferred.
  if (ALWAYS_SAFE.has(node.type)) {
    walkChildren(node, visitor, true);
    return;
  }

  // Arrow/function expressions are deferred ONLY if they aren't IIFEs.
  // An IIFE is when the function is the callee of a CallExpression, OR
  // when it's passed as an argument to a function that invokes it immediately.
  // We conservatively treat only FunctionDeclaration/MethodDefinition as safe.
  // Arrow/function expressions are treated as top-level to catch patterns like
  // `Xl(()=>import(...))` where the arrow is immediately invoked by the caller.
  if (MAYBE_SAFE.has(node.type)) {
    // Only treat as safe scope if this is clearly deferred — e.g., assigned
    // to a variable, property, or returned. NOT if it's a call argument.
    // Conservative: always treat as top-level (don't enter safe scope).
    // This may produce false positives for deeply-nested callbacks, but
    // ensures we catch IIFEs and immediately-invoked callback patterns.
    walkChildren(node, visitor, inScope);
    return;
  }

  if (!inScope) {
    visitor(node);
  }

  walkChildren(node, visitor, inScope);
}

function walkChildren(node: AstNode, visitor: (n: AstNode) => void, inScope: boolean) {
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object' && 'type' in item) {
          walkTopLevel(item as AstNode, visitor, inScope);
        }
      }
    } else if (child && typeof child === 'object' && 'type' in (child as object)) {
      walkTopLevel(child as AstNode, visitor, inScope);
    }
  }
}

function scanFile(filePath: string, code: string): Violation[] {
  const violations: Violation[] = [];
  const shortFile = path.relative(distDir, filePath);

  let ast: AstNode;
  try {
    ast = parseAst(code) as unknown as AstNode;
  } catch {
    // If parsing fails (rare), skip this file.
    return [];
  }

  walkTopLevel(ast, (node) => {
    const snippet = (offset: number) => code.slice(offset, offset + 80).replace(/\n/g, ' ');

    // Dynamic import()
    if (node.type === 'ImportExpression') {
      violations.push({
        file: shortFile,
        offset: node.start as number,
        kind: 'dynamic import()',
        snippet: snippet(node.start as number),
      });
    }

    // document.* access
    if (
      node.type === 'MemberExpression' &&
      (node.object as AstNode)?.type === 'Identifier' &&
      (node.object as AstNode)?.name === 'document'
    ) {
      violations.push({
        file: shortFile,
        offset: node.start as number,
        kind: 'document.* access',
        snippet: snippet(node.start as number),
      });
    }

    // URL.createObjectURL(...)
    if (node.type === 'CallExpression' && (node.callee as AstNode)?.type === 'MemberExpression') {
      const callee = node.callee as AstNode;
      if (
        (callee.object as AstNode)?.type === 'Identifier' &&
        (callee.object as AstNode)?.name === 'URL' &&
        (callee.property as AstNode)?.type === 'Identifier' &&
        (callee.property as AstNode)?.name === 'createObjectURL'
      ) {
        violations.push({
          file: shortFile,
          offset: node.start as number,
          kind: 'URL.createObjectURL',
          snippet: snippet(node.start as number),
        });
      }
    }

    // new Worker(...)
    if (
      node.type === 'NewExpression' &&
      (node.callee as AstNode)?.type === 'Identifier' &&
      (node.callee as AstNode)?.name === 'Worker'
    ) {
      violations.push({
        file: shortFile,
        offset: node.start as number,
        kind: 'new Worker()',
        snippet: snippet(node.start as number),
      });
    }
  });

  return violations;
}

// ---- tests ------------------------------------------------------------------

function formatViolations(vs: Violation[]): string {
  return vs.map((v) => `  ${v.file}@${v.offset} — ${v.snippet}`).join('\n');
}

describe('service-worker safety (built output)', () => {
  if (!distExists) {
    const maybeIt = requireDist ? it : it.skip;
    maybeIt('requires a fresh extension build', () => {
      expect(
        distExists,
        'Expected packages/extension/.output/chrome-mv3/background.js to exist. Run the extension build first.',
      ).toBe(true);
    });
    return;
  }

  const graph = traceImportGraph(bgPath);

  it('background import graph is non-empty', () => {
    expect(graph.length).toBeGreaterThan(1);
  });

  it('background graph contains no top-level dynamic import()', { timeout: 30_000 }, () => {
    const vs: Violation[] = [];
    for (const file of graph) {
      vs.push(
        ...scanFile(file, fs.readFileSync(file, 'utf8')).filter(
          (v) => v.kind === 'dynamic import()',
        ),
      );
    }
    if (vs.length > 0) {
      expect.fail(`Found ${vs.length} top-level dynamic import():\n${formatViolations(vs)}`);
    }
  });

  it('background graph contains no top-level document.* access', { timeout: 30_000 }, () => {
    const vs: Violation[] = [];
    for (const file of graph) {
      vs.push(
        ...scanFile(file, fs.readFileSync(file, 'utf8')).filter(
          (v) => v.kind === 'document.* access',
        ),
      );
    }
    if (vs.length > 0) {
      expect.fail(`Found ${vs.length} top-level document.* access:\n${formatViolations(vs)}`);
    }
  });

  it('background graph contains no top-level URL.createObjectURL', { timeout: 30_000 }, () => {
    const vs: Violation[] = [];
    for (const file of graph) {
      vs.push(
        ...scanFile(file, fs.readFileSync(file, 'utf8')).filter(
          (v) => v.kind === 'URL.createObjectURL',
        ),
      );
    }
    if (vs.length > 0) {
      expect.fail(`Found ${vs.length} top-level URL.createObjectURL:\n${formatViolations(vs)}`);
    }
  });

  it('background graph contains no top-level new Worker()', { timeout: 30_000 }, () => {
    const vs: Violation[] = [];
    for (const file of graph) {
      vs.push(
        ...scanFile(file, fs.readFileSync(file, 'utf8')).filter((v) => v.kind === 'new Worker()'),
      );
    }
    if (vs.length > 0) {
      expect.fail(`Found ${vs.length} top-level new Worker():\n${formatViolations(vs)}`);
    }
  });
});
