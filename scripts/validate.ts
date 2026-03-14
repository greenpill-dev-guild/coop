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
  'e2e:app:desktop': {
    description: 'Desktop landing-page Playwright checks.',
    steps: [{ label: 'e2e:app:desktop', command: ['bun', 'run', 'test:e2e:app'] }],
  },
  'e2e:app:mobile': {
    description: 'Mobile landing-page Playwright checks.',
    steps: [{ label: 'e2e:app:mobile', command: ['bun', 'run', 'test:e2e:app:mobile'] }],
  },
  'e2e:extension': {
    description: 'Two-profile extension core-loop Playwright flow in mock onchain/archive mode.',
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
      'Archive probe that issues local trusted-node delegation material from repo-root env or an in-process fallback.',
    steps: [{ label: 'probe:archive-live', command: ['bun', 'run', 'probe:archive-live'] }],
  },
  smoke: {
    description: 'Fast confidence pass for shared logic and package builds.',
    includes: ['unit', 'build'],
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
      'Smart Session validation: lint, targeted onchain/session-key tests, build, then an opt-in live Sepolia-first Smart Session rehearsal.',
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
      'Archive live-path validation: lint, targeted archive tests, build, then a trusted-node delegation probe using root env or an in-process fallback.',
    includes: ['lint', 'unit:archive-live', 'build', 'probe:archive-live'],
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
  'delegated-execution': {
    description:
      'Delegated execution validation: lint, targeted grant unit tests, policy tests, build.',
    includes: ['lint', 'unit:delegated-execution', 'unit:agent-policy', 'build'],
  },
  'agent-loop': {
    description:
      'Trusted-node agent validation: lint, targeted loop tests, local inference, policy/grant checks, and extension build.',
    includes: [
      'lint',
      'unit:agent-loop',
      'unit:local-inference',
      'unit:agent-policy',
      'unit:delegated-execution',
      'build',
      'e2e:agent-loop',
    ],
  },
  'production-readiness': {
    description:
      'Final pre-demo production slice: lint, build, targeted agent/onchain/session tests, extension and receiver E2E, plus mobile app coverage.',
    includes: [
      'lint',
      'build',
      'unit:agent-loop',
      'unit:onchain-config',
      'unit:session-key',
      'e2e:extension',
      'e2e:receiver-sync',
      'e2e:agent-loop',
      'e2e:app:mobile',
    ],
  },
  full: {
    description: 'Full local validation pass used before demos or bigger merges.',
    includes: [
      'lint',
      'unit',
      'build',
      'landing',
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
