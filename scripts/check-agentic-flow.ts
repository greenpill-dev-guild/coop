#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const DEFAULT_SCAN_ROOTS = ['packages/app', 'packages/extension', 'packages/api'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

export interface ImportFinding {
  file: string;
  line: number;
  specifier: string;
}

export function loadAllowedSharedImports(rootDir = process.cwd()): Set<string> {
  const packagePath = path.join(rootDir, 'packages/shared/package.json');
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    exports?: Record<string, unknown>;
  };
  const allowed = new Set<string>();

  for (const key of Object.keys(manifest.exports ?? {})) {
    if (key === '.') {
      allowed.add('@coop/shared');
      continue;
    }
    if (key.startsWith('./')) {
      allowed.add(`@coop/shared/${key.slice(2)}`);
    }
  }

  return allowed;
}

function shouldSkipDirectory(name: string) {
  return ['node_modules', 'dist', 'coverage', '.wxt', '.turbo', '.claude', '.plans'].includes(name);
}

function collectSourceFiles(rootDir: string, scanRoots = DEFAULT_SCAN_ROOTS): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    if (!existsSync(currentDir)) return;

    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      files.push(fullPath);
    }
  }

  for (const scanRoot of scanRoots) {
    const absoluteRoot = path.resolve(rootDir, scanRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    const stats = statSync(absoluteRoot);
    if (stats.isDirectory()) {
      walk(absoluteRoot);
      continue;
    }
    if (stats.isFile() && SOURCE_EXTENSIONS.has(path.extname(absoluteRoot))) {
      files.push(absoluteRoot);
    }
  }

  return files.sort();
}

function lineNumberForOffset(content: string, offset: number) {
  return content.slice(0, offset).split('\n').length;
}

function extractImportSpecifiers(content: string): Array<{ specifier: string; index: number }> {
  const imports: Array<{ specifier: string; index: number }> = [];
  const sourceFile = ts.createSourceFile(
    'agentic-flow-source.tsx',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function addStringLiteral(node: ts.Node | undefined) {
    if (!node || !ts.isStringLiteralLike(node)) return;
    imports.push({ specifier: node.text, index: node.getStart(sourceFile) });
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addStringLiteral(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addStringLiteral(node.arguments[0]);
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length > 0
      ) {
        addStringLiteral(node.arguments[0]);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return imports;
}

export function collectAgenticFlowImportFindings(rootDir = process.cwd()): ImportFinding[] {
  const allowedSharedImports = loadAllowedSharedImports(rootDir);
  const findings: ImportFinding[] = [];

  for (const file of collectSourceFiles(rootDir)) {
    const content = readFileSync(file, 'utf8');
    for (const { specifier, index } of extractImportSpecifiers(content)) {
      if (!specifier.startsWith('@coop/shared/')) continue;
      if (allowedSharedImports.has(specifier)) continue;

      findings.push({
        file: path.relative(rootDir, file).split(path.sep).join('/'),
        line: lineNumberForOffset(content, index),
        specifier,
      });
    }
  }

  return findings;
}

export function formatImportFindings(findings: ImportFinding[]): string {
  if (findings.length === 0) {
    return '[agentic-flow] No disallowed @coop/shared subpath imports found.';
  }

  return [
    '[agentic-flow] Advisory: disallowed @coop/shared subpath imports found.',
    ...findings.map((finding) => `${finding.file}:${finding.line} ${finding.specifier}`),
    'Use a public export from packages/shared/package.json or add a deliberate export first.',
  ].join('\n');
}

export function runAgenticFlowCheck(input?: { rootDir?: string; strict?: boolean }) {
  const findings = collectAgenticFlowImportFindings(input?.rootDir);
  const output = formatImportFindings(findings);
  const exitCode = input?.strict && findings.length > 0 ? 1 : 0;
  return { findings, output, exitCode };
}

if (import.meta.main) {
  const strict = process.argv.includes('--strict');
  const result = runAgenticFlowCheck({ strict });
  console.log(result.output);
  process.exit(result.exitCode);
}
