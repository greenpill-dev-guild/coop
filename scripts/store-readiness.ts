#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import {
  resolveReceiverBridgeMatches,
  validateStoreReceiverAppUrl,
} from '../packages/extension/src/build/receiver-matches';
import { loadRootEnv, repoRoot } from './load-root-env';

loadRootEnv();

const extensionDistDir = path.join(repoRoot, 'packages/extension/.output/chrome-mv3');
const manifestPath = path.join(extensionDistDir, 'manifest.json');
const requiredDocPaths = [
  'docs/community/privacy-policy.md',
  'docs/reference/chrome-web-store-reviewer-notes.md',
  'docs/reference/chrome-web-store-checklist.md',
  'docs/reference/remote-knowledge-skill-reenable-checklist.md',
];

const executableExtensions = new Set(['.js', '.mjs', '.wasm']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs']);
const quarantinedKnowledgeSkillTokens = [
  'import-knowledge-skill',
  'refresh-knowledge-skill',
  'set-coop-knowledge-skill-enabled',
  'set-coop-knowledge-skill-trigger-patterns',
];

const bundleBudgets = [
  { label: 'background.js', matcher: /^background\.js$/u, limitBytes: 700_000 },
  {
    label: 'transformers chunk',
    matcher: /^assets\/transformers-[^/]+\.js$/u,
    limitBytes: 1_000_000,
  },
  { label: 'webllm chunk', matcher: /^assets\/webllm-[^/]+\.js$/u, limitBytes: 6_500_000 },
  {
    label: 'packaged ONNX wasm',
    matcher: /^assets\/ort-wasm-simd-threaded\.jsep\.wasm$/u,
    limitBytes: 25_000_000,
  },
] as const;

type DistManifest = {
  host_permissions?: string[];
  content_scripts?: Array<{
    js?: string[];
    matches?: string[];
  }>;
};

type DistFile = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }
  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(2)} kB`;
  }
  return `${bytes} B`;
}

function listDistFiles(dir: string): DistFile[] {
  const files: DistFile[] = [];

  function walk(currentDir: string) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      files.push({
        absolutePath,
        relativePath: path.relative(dir, absolutePath).replaceAll(path.sep, '/'),
        size: fs.statSync(absolutePath).size,
      });
    }
  }

  walk(dir);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isExactOriginPattern(match: string) {
  return /^https?:\/\/[^/*]+\/\*$/u.test(match) && !match.includes('*.');
}

function getReceiverBridgeMatches(manifest: DistManifest) {
  return (
    manifest.content_scripts?.find((entry) =>
      entry.js?.some((scriptPath) => scriptPath.includes('receiver-bridge')),
    )?.matches ?? []
  )
    .slice()
    .sort();
}

function extractRemoteExecutableUrls(contents: string) {
  const matches: string[] = [];
  const pattern = /https?:\/\/[^\s"'`\\)]+/giu;

  for (const match of contents.matchAll(pattern)) {
    const rawUrl = match[0].replace(/[),.;]+$/u, '');
    try {
      const parsed = new URL(rawUrl);
      const pathname = parsed.pathname.toLowerCase();
      if ([...executableExtensions].some((extension) => pathname.endsWith(extension))) {
        matches.push(parsed.href);
      }
    } catch {
      // URL parse failed — skip this match
    }
  }

  return [...new Set(matches)].sort();
}

function countEvalLikeConstructs(contents: string) {
  return {
    evalCount: (contents.match(/\beval\(/gu) ?? []).length,
    functionConstructorCount: (contents.match(/new Function\(/gu) ?? []).length,
  };
}

function readTextFile(file: DistFile) {
  return fs.readFileSync(file.absolutePath, 'utf8');
}

function fail(errors: string[], message: string) {
  errors.push(message);
}

async function main() {
  const errors: string[] = [];

  if (!fs.existsSync(extensionDistDir)) {
    fail(
      errors,
      'Missing packages/extension/.output/chrome-mv3. Run `cd packages/extension && bun run build` first.',
    );
  }

  if (!fs.existsSync(manifestPath)) {
    fail(
      errors,
      'Missing packages/extension/.output/chrome-mv3/manifest.json. Run a fresh extension build first.',
    );
  }

  const distFiles = fs.existsSync(extensionDistDir) ? listDistFiles(extensionDistDir) : [];
  const totalDistBytes = distFiles.reduce((sum, file) => sum + file.size, 0);

  for (const relativeDocPath of requiredDocPaths) {
    const absoluteDocPath = path.join(repoRoot, relativeDocPath);
    if (!fs.existsSync(absoluteDocPath)) {
      fail(errors, `Missing release artifact: ${relativeDocPath}`);
    }
  }

  const validatedReceiverAppUrl = validateStoreReceiverAppUrl(
    process.env.VITE_COOP_RECEIVER_APP_URL,
  );
  if (!validatedReceiverAppUrl.ok) {
    fail(errors, validatedReceiverAppUrl.message);
  }

  const junkFiles = distFiles.filter((file) => path.basename(file.relativePath).startsWith('.'));
  if (junkFiles.length > 0) {
    fail(
      errors,
      `Unexpected hidden files in extension dist: ${junkFiles.map((file) => file.relativePath).join(', ')}`,
    );
  }

  let manifest: DistManifest | null = null;
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DistManifest;

    const actualHostPermissions = [...(manifest.host_permissions ?? [])].sort();
    const receiverBridgeMatches = getReceiverBridgeMatches(manifest);

    if (validatedReceiverAppUrl.ok) {
      const expectedMatches = resolveReceiverBridgeMatches(validatedReceiverAppUrl.url.href).sort();

      if (JSON.stringify(actualHostPermissions) !== JSON.stringify(expectedMatches)) {
        fail(
          errors,
          `Manifest host_permissions drifted. Expected ${expectedMatches.join(', ')} but found ${actualHostPermissions.join(', ') || '(none)'}.`,
        );
      }

      if (JSON.stringify(receiverBridgeMatches) !== JSON.stringify(expectedMatches)) {
        fail(
          errors,
          `receiver-bridge content script matches drifted. Expected ${expectedMatches.join(', ')} but found ${receiverBridgeMatches.join(', ') || '(none)'}.`,
        );
      }
    }

    const nonExactPermissions = actualHostPermissions.filter(
      (match) => !isExactOriginPattern(match),
    );
    if (nonExactPermissions.length > 0) {
      fail(
        errors,
        `Manifest host_permissions must stay exact origin allowlists. Invalid entries: ${nonExactPermissions.join(', ')}`,
      );
    }
  }

  for (const budget of bundleBudgets) {
    const match = distFiles.find((file) => budget.matcher.test(file.relativePath));
    if (!match) {
      fail(errors, `Missing expected bundle for budget check: ${budget.label}`);
      continue;
    }
    if (match.size > budget.limitBytes) {
      fail(
        errors,
        `${budget.label} exceeds budget: ${match.relativePath} is ${formatBytes(match.size)} (limit ${formatBytes(budget.limitBytes)}).`,
      );
    }
  }

  if (totalDistBytes > 70_000_000) {
    fail(
      errors,
      `Extension dist exceeds total budget: ${formatBytes(totalDistBytes)} (limit ${formatBytes(70_000_000)}).`,
    );
  }

  for (const file of distFiles) {
    const extension = path.extname(file.relativePath);
    if (!textExtensions.has(extension)) {
      continue;
    }

    const contents = readTextFile(file);
    const remoteExecutables = extractRemoteExecutableUrls(contents);
    if (remoteExecutables.length > 0) {
      fail(
        errors,
        `Remote executable URLs found in ${file.relativePath}: ${remoteExecutables.join(', ')}`,
      );
    }

    const leakedKnowledgeSkillTokens = quarantinedKnowledgeSkillTokens.filter((token) =>
      contents.includes(token),
    );
    if (leakedKnowledgeSkillTokens.length > 0) {
      fail(
        errors,
        `Quarantined remote knowledge-skill tokens leaked into ${file.relativePath}: ${leakedKnowledgeSkillTokens.join(', ')}`,
      );
    }

    if (extension === '.js' || extension === '.mjs') {
      const { evalCount, functionConstructorCount } = countEvalLikeConstructs(contents);
      if (evalCount > 0 || functionConstructorCount > 0) {
        fail(
          errors,
          `Dynamic code execution helpers found in ${file.relativePath}: eval=${evalCount}, new Function=${functionConstructorCount}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('[store-readiness] Chrome Web Store audit failed.');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[store-readiness] Chrome Web Store audit passed.');
  console.log(`[store-readiness] Dist size: ${formatBytes(totalDistBytes)}`);
  for (const budget of bundleBudgets) {
    const match = distFiles.find((file) => budget.matcher.test(file.relativePath));
    if (match) {
      console.log(
        `[store-readiness] ${budget.label}: ${match.relativePath} ${formatBytes(match.size)} / ${formatBytes(budget.limitBytes)}`,
      );
    }
  }
  if (manifest) {
    console.log(
      `[store-readiness] Receiver origins: ${(manifest.host_permissions ?? []).slice().sort().join(', ')}`,
    );
  }
}

await main();
