#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

interface Step {
  label: string;
  command: string[];
}

interface LeafSuite {
  description: string;
  steps: Step[];
  includes?: never;
}

interface CompositeSuite {
  description: string;
  includes: string[];
  steps?: never;
}

type Suite = LeafSuite | CompositeSuite;

const suites: Record<string, Suite> = {
  typecheck: {
    description:
      'Fast tsc --noEmit across all packages (~5-10s). Catches type errors without building.',
    steps: [{ label: 'typecheck', command: ['bun', 'run', 'typecheck'] }],
  },
  lint: {
    description: 'Biome static checks across the workspace.',
    steps: [{ label: 'lint', command: ['bun', 'run', 'lint'] }],
  },
  unit: {
    description: 'Vitest unit and integration coverage across app, extension runtime, and shared.',
    steps: [{ label: 'unit', command: ['bun', 'run', 'test'] }],
  },
  coverage: {
    description: 'Vitest coverage run with thresholds enabled.',
    steps: [{ label: 'coverage', command: ['bun', 'run', 'test:coverage'] }],
  },
  build: {
    description: 'Build shared, app, and extension packages.',
    steps: [{ label: 'build', command: ['bun', 'run', 'build'] }],
  },
  'build:extension': {
    description: 'Build the extension package only.',
    steps: [{ label: 'build:extension', command: ['bun', 'run', 'build:extension'] }],
  },
  'e2e:app:desktop': {
    description: 'Desktop landing-page Playwright checks.',
    steps: [{ label: 'e2e:app:desktop', command: ['bun', 'run', 'test:e2e:app'] }],
  },
  'e2e:app:mobile': {
    description: 'Mobile landing-page Playwright checks.',
    steps: [{ label: 'e2e:app:mobile', command: ['bun', 'run', 'test:e2e:app:mobile'] }],
  },
  'e2e:popup': {
    description:
      'Focused popup browser smoke coverage for roundup, screenshot gating, file/audio review, and post-failure recovery.',
    steps: [{ label: 'e2e:popup', command: ['bun', 'run', 'test:e2e:popup'] }],
  },
  'e2e:extension': {
    description:
      'Extension browser workflows for member join, board/archive handoff, trusted-helper runs, and mock-path sidepanel onchain actions.',
    steps: [
      {
        label: 'e2e:extension',
        command: ['bun', 'run', 'test:e2e:extension'],
      },
    ],
  },
  'e2e:agent-loop': {
    description:
      'Focused Playwright flow for the operator-console agent dashboard and manual trusted-node cycle.',
    steps: [{ label: 'e2e:agent-loop', command: ['bun', 'run', 'test:e2e:agent-loop'] }],
  },
  'unit:flow-board': {
    description:
      'Targeted Vitest coverage for the board graph, board handoff, archive receipts, and archive-worthy state transitions.',
    steps: [{ label: 'unit:flow-board', command: ['bun', 'run', 'test:unit:flow-board'] }],
  },
  'unit:archive-live': {
    description:
      'Targeted Vitest coverage for anchor gating, trusted-node archive delegation, follow-up refresh, and operator log rendering.',
    steps: [{ label: 'unit:archive-live', command: ['bun', 'run', 'test:unit:archive-live'] }],
  },
  'e2e:flow-board': {
    description:
      'Targeted Playwright flow for the board route and extension archive-to-board handoff.',
    steps: [{ label: 'e2e:flow-board', command: ['bun', 'run', 'test:e2e:flow-board'] }],
  },
  'e2e:receiver-sync': {
    description: 'Receiver PWA pairing and private intake sync flow in the extension.',
    steps: [
      {
        label: 'e2e:receiver-sync',
        command: ['bun', 'run', 'test:e2e:receiver-sync'],
      },
    ],
  },
  'e2e:sync': {
    description:
      'Focused extension sync browser coverage for popup sync resilience and degraded-state recovery.',
    steps: [{ label: 'e2e:sync', command: ['bun', 'run', 'test:e2e:sync'] }],
  },
  'unit:popup-actions': {
    description:
      'Popup action matrix coverage for popup flows, capture preflight, and popup-specific state transitions.',
    steps: [{ label: 'unit:popup-actions', command: ['bun', 'run', 'test:unit:popup-actions'] }],
  },
  'unit:sidepanel-actions': {
    description:
      'Sidepanel action persistence coverage for refreshed dashboard state, shell wiring, and dashboard hook behavior.',
    steps: [
      { label: 'unit:sidepanel-actions', command: ['bun', 'run', 'test:unit:sidepanel-actions'] },
    ],
  },
  'unit:archive-hardening': {
    description:
      'Archive persistence coverage for receipt recovery, blob upload reconciliation, and coop archive config UI state.',
    steps: [
      { label: 'unit:archive-hardening', command: ['bun', 'run', 'test:unit:archive-hardening'] },
    ],
  },
  'unit:receiver-intake': {
    description:
      'Focused receiver/background coverage for pairing lifecycle, intake ingestion, invite coordination, offscreen wake-up, and related context helpers.',
    steps: [
      { label: 'unit:receiver-intake', command: ['bun', 'run', 'test:unit:receiver-intake'] },
    ],
  },
  'unit:sync-hardening': {
    description:
      'Deterministic sync coverage for shared transport health, receiver replication, receiver invite persistence, popup sync semantics, and dashboard hook summaries.',
    steps: [{ label: 'unit:sync-hardening', command: ['bun', 'run', 'test:unit:sync-hardening'] }],
  },
  'unit:onchain-ui': {
    description:
      'Mock-path onchain coverage for extension-side passkey helpers, operator console states, and sidepanel member-account/session actions.',
    steps: [{ label: 'unit:onchain-ui', command: ['bun', 'run', 'test:unit:onchain-ui'] }],
  },
  'unit:onchain-config': {
    description:
      'Targeted Vitest coverage for onchain schema normalization, chain config resolution, and Pimlico/Safe helpers.',
    steps: [{ label: 'unit:onchain-config', command: ['bun', 'run', 'test:unit:onchain-config'] }],
  },
  'unit:session-key': {
    description:
      'Targeted Vitest coverage for Smart Session scope validation, typed action metadata, expiry/revocation logic, and encrypted local signer storage.',
    steps: [{ label: 'unit:session-key', command: ['bun', 'run', 'test:unit:session-key'] }],
  },
  'unit:session-executors': {
    description:
      'Focused extension/session coverage for capability selection, live revoke/rotate flows, execution context construction, and sidepanel permit hooks.',
    steps: [
      { label: 'unit:session-executors', command: ['bun', 'run', 'test:unit:session-executors'] },
    ],
  },
  'unit:action-executors': {
    description:
      'Focused background execution coverage for action dispatch, replay logging, archive/review executor routing, and non-Green-Goods executor behavior.',
    steps: [
      { label: 'unit:action-executors', command: ['bun', 'run', 'test:unit:action-executors'] },
    ],
  },
  'unit:background-dashboard': {
    description:
      'Focused background coverage for dashboard assembly, popup snapshot/badge writes, alarms, and context bootstrap helpers.',
    steps: [
      {
        label: 'unit:background-dashboard',
        command: ['bun', 'run', 'test:unit:background-dashboard'],
      },
    ],
  },
  'unit:sidepanel-settings': {
    description:
      'Focused sidepanel interaction coverage for Nest settings handlers plus Roost and Chickens workflow controls.',
    steps: [
      { label: 'unit:sidepanel-settings', command: ['bun', 'run', 'test:unit:sidepanel-settings'] },
    ],
  },
  'probe:onchain-live': {
    description:
      'Optional live Safe probe on Ethereum Sepolia by default. Skips cleanly when probe env vars are absent.',
    steps: [{ label: 'probe:onchain-live', command: ['bun', 'run', 'probe:onchain-live'] }],
  },
  'probe:session-key-live': {
    description:
      'Optional Smart Session probe on Ethereum Sepolia/Arbitrum that enables a bounded session, executes an allowed Green Goods action, confirms a rejection path, and revokes the session.',
    steps: [{ label: 'probe:session-key-live', command: ['bun', 'run', 'probe:session-key-live'] }],
  },
  'probe:archive-live': {
    description:
      'Archive probe that requires real trusted-node delegation material from repo-root env; optional fallback wiring checks require COOP_ALLOW_ARCHIVE_PROBE_FALLBACK=true.',
    steps: [{ label: 'probe:archive-live', command: ['bun', 'run', 'probe:archive-live'] }],
  },
  'probe:greengoods-sim': {
    description:
      'Green Goods create-garden rehearsal against a real coop Safe and chain RPC, including the wrapped Safe execution path when an owner key is provided.',
    steps: [{ label: 'probe:greengoods-sim', command: ['bun', 'run', 'probe:greengoods-sim'] }],
  },
  'probe:greengoods-admin-sim': {
    description:
      'Green Goods post-mint admin rehearsal for profile sync, domain sync, pool creation, gardener membership, and GAP admin changes.',
    steps: [
      {
        label: 'probe:greengoods-admin-sim',
        command: ['bun', 'run', 'probe:greengoods-admin-sim'],
      },
    ],
  },
  'probe:fvm-registry-live': {
    description:
      'Filecoin registry deployment probe that verifies the configured CoopRegistry address has contract code and a readable ABI surface.',
    steps: [
      { label: 'probe:fvm-registry-live', command: ['bun', 'run', 'probe:fvm-registry-live'] },
    ],
  },
  quick: {
    description: 'Fastest useful validation: typecheck + lint (~15s). No build or tests.',
    includes: ['typecheck', 'lint'],
  },
  'popup-slice': {
    description:
      'Popup validation slice: popup action unit coverage plus popup browser smoke coverage.',
    includes: ['unit:popup-actions', 'e2e:popup'],
  },
  'receiver-intake': {
    description:
      'Receiver intake validation: focused receiver/background tests, extension build, and receiver pairing/sync E2E.',
    includes: ['unit:receiver-intake', 'build:extension', 'e2e:receiver-sync'],
  },
  smoke: {
    description: 'Fast confidence pass for shared logic and package builds.',
    includes: ['unit', 'build'],
  },
  'sync-hardening': {
    description:
      'Sync hardening validation: targeted sync unit coverage plus browser sync rehearsal.',
    includes: ['unit:sync-hardening', 'e2e:sync'],
  },
  'onchain-ui': {
    description:
      'Onchain UI validation: targeted mock-path onchain extension coverage without live RPC dependencies.',
    includes: ['unit:onchain-ui'],
  },
  'session-executors': {
    description:
      'Session executor validation: focused session/permit tests plus an extension build safety pass.',
    includes: ['unit:session-executors', 'build:extension'],
  },
  'action-executors': {
    description:
      'Action executor validation: focused background execution tests plus an extension build safety pass.',
    includes: ['unit:action-executors', 'build:extension'],
  },
  'background-dashboard': {
    description:
      'Background dashboard validation: focused assembly/bootstrap coverage plus an extension build safety pass.',
    includes: ['unit:background-dashboard', 'build:extension'],
  },
  'sidepanel-settings': {
    description:
      'Sidepanel settings validation: focused Nest/Roost/Chickens interaction coverage plus an extension build safety pass.',
    includes: ['unit:sidepanel-settings', 'build:extension'],
  },
  landing: {
    description: 'Landing-page validation on desktop and mobile.',
    includes: ['e2e:app:desktop', 'e2e:app:mobile'],
  },
  'core-loop': {
    description: 'Main Coop workflow validation: unit tests, build, then extension E2E.',
    includes: ['unit', 'build', 'e2e:extension'],
  },
  'receiver-slice': {
    description:
      'Receiver vertical slice validation: unit tests, build, app shell, and pair+sync E2E.',
    includes: ['unit', 'build', 'e2e:app:desktop', 'e2e:receiver-sync'],
  },
  'receiver-hardening': {
    description:
      'Receiver hardening validation: lint, unit coverage, build, and sidepanel-closed sync E2E.',
    includes: ['lint', 'unit', 'build', 'e2e:receiver-sync'],
  },
  'multi-coop-routing': {
    description:
      'Multi-coop routing validation: shared logic, package builds, core extension flow, and receiver review publish.',
    includes: ['unit', 'build', 'e2e:extension', 'e2e:receiver-sync'],
  },
  'review-meeting-mode': {
    description:
      'Meeting-mode validation: shared review logic, package builds, and receiver private-intake ritual flow.',
    includes: ['unit', 'build', 'e2e:receiver-sync'],
  },
  'flow-board': {
    description:
      'Board and archive-story validation: targeted unit coverage, build, then focused Playwright flow.',
    includes: ['unit:flow-board', 'build', 'e2e:flow-board'],
  },
  'arbitrum-safe-live': {
    description:
      'Arbitrum/Sepolia Safe validation: lint, targeted onchain tests, build, then an optional Sepolia-first live probe.',
    includes: ['lint', 'unit:onchain-config', 'build', 'probe:onchain-live'],
  },
  'session-key-live': {
    description:
      'Smart Session validation: lint, targeted onchain/session-key tests, build, then a chain-selectable live Smart Session rehearsal.',
    includes: [
      'lint',
      'unit:onchain-config',
      'unit:session-key',
      'build',
      'probe:session-key-live',
    ],
  },
  'archive-live': {
    description:
      'Archive live-path validation: lint, targeted archive tests, build, then a trusted-node delegation probe that requires operator archive env.',
    includes: ['lint', 'unit:archive-live', 'build', 'probe:archive-live'],
  },
  'greengoods-live': {
    description:
      'Green Goods live rehearsal: create-garden and post-mint admin dry-runs against a real coop Safe and non-rate-limited RPC.',
    includes: ['probe:greengoods-sim', 'probe:greengoods-admin-sim'],
  },
  'fvm-registry-live': {
    description:
      'Filecoin registry deployment validation: confirm the handoff registry address is deployed and readable before a live demo.',
    includes: ['probe:fvm-registry-live'],
  },
  'unit:local-inference': {
    description:
      'Targeted Vitest coverage for local inference provider selection, capability detection, refine shaping, worker bridge, and heuristic fallback.',
    steps: [
      { label: 'unit:local-inference', command: ['bun', 'run', 'test:unit:local-inference'] },
    ],
  },
  'unit:agent-loop': {
    description:
      'Targeted Vitest coverage for agent contracts, skill registry loading, provider fallback, and operator-console agent controls.',
    steps: [{ label: 'unit:agent-loop', command: ['bun', 'run', 'test:unit:agent-loop'] }],
  },
  'unit:agent-eval': {
    description:
      'Skill eval fixture coverage and structural/semantic assertion pass across all registered skills.',
    steps: [{ label: 'unit:agent-eval', command: ['bun', 'run', 'test:unit:agent-eval'] }],
  },
  'local-inference': {
    description: 'Local inference validation: lint, targeted inference unit tests, build.',
    includes: ['lint', 'unit:local-inference', 'build'],
  },
  'unit:agent-policy': {
    description:
      'Targeted Vitest coverage for action policies, bundles, replay protection, approval queue, and bounded execution.',
    steps: [{ label: 'unit:agent-policy', command: ['bun', 'run', 'test:unit:agent-policy'] }],
  },
  'agent-policy': {
    description: 'Agent policy validation: lint, targeted policy unit tests, build.',
    includes: ['lint', 'unit:agent-policy', 'build'],
  },
  'unit:delegated-execution': {
    description:
      'Targeted Vitest coverage for delegated execution grants, enforcement, audit logging, and operator console rendering.',
    steps: [
      {
        label: 'unit:delegated-execution',
        command: ['bun', 'run', 'test:unit:delegated-execution'],
      },
    ],
  },
  'unit:store-readiness': {
    description:
      'Targeted Vitest coverage for encrypted local storage, packaged ONNX runtime assets, and scheduled capture alarm dispatch.',
    steps: [
      { label: 'unit:store-readiness', command: ['bun', 'run', 'test:unit:store-readiness'] },
    ],
  },
  'unit:extension-dist': {
    description:
      'Built-output MV3 service-worker safety validation that requires a fresh extension dist.',
    steps: [{ label: 'unit:extension-dist', command: ['bun', 'run', 'test:unit:extension-dist'] }],
  },
  'audit:store-readiness': {
    description:
      'Post-build Chrome Web Store audit for manifest drift, remote executable URLs, bundle budgets, and required release docs.',
    steps: [{ label: 'audit:store-readiness', command: ['bun', 'run', 'test:store-readiness'] }],
  },
  'delegated-execution': {
    description:
      'Delegated execution validation: lint, targeted grant unit tests, policy tests, build.',
    includes: ['lint', 'unit:delegated-execution', 'unit:agent-policy', 'build'],
  },
  'store-readiness': {
    description:
      'Chrome Web Store readiness validation: build, targeted storage/runtime tests, built-output safety checks, and dist/document audits.',
    includes: ['build', 'unit:store-readiness', 'unit:extension-dist', 'audit:store-readiness'],
  },
  'agent-loop': {
    description:
      'Trusted-node agent validation: lint, targeted loop tests, local inference, policy/grant checks, and extension build.',
    includes: [
      'lint',
      'unit:agent-loop',
      'unit:agent-eval',
      'unit:local-inference',
      'unit:agent-policy',
      'unit:delegated-execution',
      'build',
      'e2e:agent-loop',
    ],
  },
  'production-readiness': {
    description:
      'Expanded pre-release slice: lint, build, popup and sidepanel action coverage, archive and sync hardening, targeted agent/onchain/session tests, extension/receiver E2E, and mobile app coverage.',
    includes: [
      'lint',
      'build',
      'store-readiness',
      'popup-slice',
      'unit:sidepanel-actions',
      'unit:archive-hardening',
      'sync-hardening',
      'onchain-ui',
      'unit:agent-loop',
      'unit:onchain-config',
      'unit:session-key',
      'e2e:extension',
      'e2e:receiver-sync',
      'e2e:agent-loop',
      'e2e:app:mobile',
    ],
  },
  'production-live-readiness': {
    description:
      'Production-readiness plus opt-in live probes for shared-wallet, session-key, archive, and Filecoin registry rails.',
    includes: [
      'production-readiness',
      'arbitrum-safe-live',
      'session-key-live',
      'greengoods-live',
      'archive-live',
      'fvm-registry-live',
    ],
  },
  full: {
    description:
      'Full local validation pass used before demos or bigger merges, including popup browser coverage.',
    includes: [
      'lint',
      'unit',
      'build',
      'landing',
      'popup-slice',
      'e2e:extension',
      'e2e:receiver-sync',
      'e2e:agent-loop',
      'e2e:flow-board',
    ],
  },
};

function printUsage(): void {
  console.log(`Usage:
  bun run validate list
  bun run validate <suite> [more suites...]
  bun run validate <suite> --dry-run

Named suites:`);
  for (const [name, suite] of Object.entries(suites)) {
    console.log(`  - ${name.padEnd(16)} ${suite.description}`);
  }
}

function resolveSuiteSteps(name: string, trail: string[] = []): Step[] {
  const suite = suites[name];
  if (!suite) {
    throw new Error(`Unknown validation suite "${name}". Run "bun run validate list".`);
  }

  if (trail.includes(name)) {
    throw new Error(`Circular validation suite definition: ${[...trail, name].join(' -> ')}`);
  }

  if (suite.steps) {
    return suite.steps;
  }

  return (suite.includes ?? []).flatMap((child) => resolveSuiteSteps(child, [...trail, name]));
}

function dedupeSteps(steps: Step[]): Step[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.label}:${step.command.join(' ')}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function runCommand(command: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      if (signal) {
        reject(new Error(`Command exited from signal ${signal}: ${command.join(' ')}`));
        return;
      }
      reject(new Error(`Command exited with code ${code}: ${command.join(' ')}`));
    });
    child.on('error', reject);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => !arg.startsWith('--'));

  if (positional.length === 0 || positional.includes('list')) {
    printUsage();
    return;
  }

  const requestedSuites = positional;
  const steps = dedupeSteps(requestedSuites.flatMap((name) => resolveSuiteSteps(name)));

  console.log(`[validate] Running suites: ${requestedSuites.join(', ')}`);
  console.log(`[validate] Expanded steps: ${steps.map((step) => step.label).join(', ')}`);

  for (const step of steps) {
    console.log(`\n[validate] ${step.label}`);
    console.log(`[validate] $ ${step.command.join(' ')}`);
    if (dryRun) {
      continue;
    }
    await runCommand(step.command);
  }

  if (dryRun) {
    console.log('\n[validate] Dry run complete.');
    return;
  }

  console.log('\n[validate] All requested suites passed.');
}

main().catch((error) => {
  console.error(`\n[validate] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
