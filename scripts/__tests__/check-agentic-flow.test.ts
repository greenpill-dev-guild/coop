import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectAgenticFlowImportFindings,
  formatImportFindings,
  loadAllowedSharedImports,
  runAgenticFlowCheck,
} from '../check-agentic-flow';

const tempDirs: string[] = [];

function makeTempRepo() {
  const rootDir = mkdtempSync(join(tmpdir(), 'coop-agentic-flow-'));
  tempDirs.push(rootDir);
  mkdirSync(join(rootDir, 'packages/shared'), { recursive: true });
  writeFileSync(
    join(rootDir, 'packages/shared/package.json'),
    JSON.stringify(
      {
        exports: {
          '.': './dist/index.js',
          './app': './dist/app-entry.js',
          './sync-config': './dist/sync-config.js',
          './testing': './dist/testing.js',
        },
      },
      null,
      2,
    ),
  );
  return rootDir;
}

function write(rootDir: string, relativePath: string, content: string) {
  const target = join(rootDir, relativePath);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('check-agentic-flow', () => {
  it('derives allowed shared imports from package exports', () => {
    const rootDir = makeTempRepo();

    expect([...loadAllowedSharedImports(rootDir)].sort()).toEqual([
      '@coop/shared',
      '@coop/shared/app',
      '@coop/shared/sync-config',
      '@coop/shared/testing',
    ]);
  });

  it('reports shared subpath imports that are not public exports', () => {
    const rootDir = makeTempRepo();
    write(
      rootDir,
      'packages/app/src/example.ts',
      [
        "import { createCoop } from '@coop/shared';",
        "import { receiverDb } from '@coop/shared/app';",
        "import { internal } from '@coop/shared/modules/auth/auth';",
      ].join('\n'),
    );

    expect(collectAgenticFlowImportFindings(rootDir)).toEqual([
      {
        file: 'packages/app/src/example.ts',
        line: 3,
        specifier: '@coop/shared/modules/auth/auth',
      },
    ]);
  });

  it('reports multiline shared subpath imports', () => {
    const rootDir = makeTempRepo();
    write(
      rootDir,
      'packages/extension/src/multiline.ts',
      ['import {', '  internalThing,', "} from '@coop/shared/modules/internal/private';"].join(
        '\n',
      ),
    );

    expect(collectAgenticFlowImportFindings(rootDir)).toEqual([
      {
        file: 'packages/extension/src/multiline.ts',
        line: 3,
        specifier: '@coop/shared/modules/internal/private',
      },
    ]);
  });

  it('scans package-level tests outside src', () => {
    const rootDir = makeTempRepo();
    write(
      rootDir,
      'packages/api/__tests__/root-api.test.ts',
      "import { internal } from '@coop/shared/modules/sync/internal';",
    );

    expect(collectAgenticFlowImportFindings(rootDir)).toEqual([
      {
        file: 'packages/api/__tests__/root-api.test.ts',
        line: 1,
        specifier: '@coop/shared/modules/sync/internal',
      },
    ]);
  });

  it('is advisory by default and strict on request', () => {
    const rootDir = makeTempRepo();
    write(
      rootDir,
      'packages/api/src/example.ts',
      "export { internal } from '@coop/shared/src/contracts/schema';",
    );

    expect(runAgenticFlowCheck({ rootDir }).exitCode).toBe(0);
    expect(runAgenticFlowCheck({ rootDir, strict: true }).exitCode).toBe(1);
    expect(formatImportFindings(runAgenticFlowCheck({ rootDir }).findings)).toContain(
      '@coop/shared/src/contracts/schema',
    );
  });
});
