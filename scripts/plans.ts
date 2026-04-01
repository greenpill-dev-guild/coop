#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import {
  constants,
  accessSync,
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

export const PLAN_ROOT = '.plans';
export const FEATURE_ROOT = join(PLAN_ROOT, 'features');
const TEMPLATE_ROOT = join(PLAN_ROOT, 'templates', 'feature');
const TODO_SUFFIX = '.todo.md';
const IMPLEMENTATION_LANES = new Set(['state', 'api', 'contracts']);
const COMPLETE_PLAN_STATUSES = new Set(['done', 'archived']);
const AUTOMATION_NOTES_HEADING = '## Automation Notes';
const DEFAULT_VALIDATION_COMMAND = 'bun run validate smoke';

type FrontmatterValue = string | string[];

export interface PlanEntry {
  path: string;
  featureDir: string;
  feature: string;
  title: string;
  lane: string;
  agent: string;
  status: string;
  sourceBranch: string;
  workBranch?: string;
  skills: string[];
  dependsOn: string[];
  ownedPaths: string[];
  doneWhen: string[];
  handoffIn?: string;
  handoffOut?: string;
  qaOrder?: number;
  updated: string;
  missingDependencies: string[];
  blockedBy: string[];
  handoffReady: boolean;
  runnable: boolean;
}

interface FilterOptions {
  agent?: string;
  lane?: string[];
  status?: string;
  runnable?: boolean;
  handoffReady?: boolean;
}

interface ValidationResult {
  featureCount: number;
  legacyPlanCount: number;
  legacyPlans: string[];
  planCount: number;
  issues: string[];
}

export interface EnvironmentPreflight {
  ok: boolean;
  writable: boolean;
  validationReady: boolean;
  validationCommand: string;
  issues: string[];
}

export interface DoneWhenEvidence {
  outcome: string;
  matched: boolean;
  matchingPaths: string[];
}

export interface PlanAssessment {
  classification: 'complete' | 'incomplete' | 'ambiguous';
  missingOwnedPaths: string[];
  inspectedFiles: string[];
  evidence: DoneWhenEvidence[];
}

export interface InboxItem {
  title: string;
  summary: string;
}

export interface ReconcileInspection {
  path: string;
  feature: string;
  lane: string;
  classification: 'complete' | 'incomplete' | 'ambiguous' | 'environment_blocked';
  statusBefore: string;
  statusAfter: string;
  note: string;
  evidence?: DoneWhenEvidence[];
  preflight?: EnvironmentPreflight;
}

export interface ReconcileResult {
  action: 'noop' | 'implement' | 'blocked';
  selectedPlanPath?: string;
  selectedFeature?: string;
  memoryPath?: string;
  memoryCreated: boolean;
  createdBranches: string[];
  inspected: ReconcileInspection[];
  inboxItem?: InboxItem;
}

interface ReconcileOptions {
  rootDir?: string;
  agent?: string;
  lane?: string[];
  automationId?: string;
  codexHome?: string;
  write?: boolean;
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(entryPath);
      }
      return entry.isFile() ? [entryPath] : [];
    });
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function parseFrontmatter(content: string): {
  data: Record<string, FrontmatterValue>;
  body: string;
} {
  if (!content.startsWith('---\n')) {
    return { data: {}, body: content };
  }

  const endIndex = content.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { data: {}, body: content };
  }

  const raw = content.slice(4, endIndex);
  const body = content.slice(endIndex + 5);
  const lines = raw.split('\n');
  const data: Record<string, FrontmatterValue> = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rest] = match;
    if (rest.trim()) {
      data[key] = stripQuotes(rest);
      continue;
    }

    const values: string[] = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1];
      const itemMatch = next.match(/^\s*-\s+(.*)$/);
      if (!itemMatch) {
        break;
      }
      values.push(stripQuotes(itemMatch[1]));
      index += 1;
    }
    data[key] = values;
  }

  return { data, body };
}

function asString(value: FrontmatterValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asList(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function relativeRepoPath(rootDir: string, absolutePath: string): string {
  const rel = relative(rootDir, absolutePath);
  return rel || '.';
}

function isImplementationLane(lane: string): boolean {
  return IMPLEMENTATION_LANES.has(lane);
}

function resolveDefaultLanes(agent: string | undefined, command: string): string[] | undefined {
  if (command !== 'queue' && command !== 'reconcile') {
    return undefined;
  }
  if (agent === 'claude') {
    return ['ui'];
  }
  if (agent === 'codex') {
    return ['state', 'api', 'contracts'];
  }
  return undefined;
}

function parsePackageScripts(rootDir: string): Record<string, string> {
  const packageJsonPath = join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return typeof parsed?.scripts === 'object' && parsed.scripts
      ? (parsed.scripts as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function isWritable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveOwnedFiles(
  rootDir: string,
  ownedPaths: string[],
): {
  files: string[];
  missingOwnedPaths: string[];
} {
  const files = new Set<string>();
  const missingOwnedPaths: string[] = [];

  for (const ownedPath of ownedPaths) {
    const absolutePath = resolve(rootDir, ownedPath);
    if (!existsSync(absolutePath)) {
      missingOwnedPaths.push(ownedPath);
      continue;
    }

    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      for (const file of walkFiles(absolutePath)) {
        files.add(file);
      }
      continue;
    }

    if (stats.isFile()) {
      files.add(absolutePath);
    }
  }

  return {
    files: Array.from(files),
    missingOwnedPaths,
  };
}

function fileContainsEvidence(rootDir: string, filePath: string, outcome: string): boolean {
  const rel = relativeRepoPath(rootDir, filePath);
  if (rel.includes(outcome)) {
    return true;
  }

  try {
    return readFileSync(filePath, 'utf8').includes(outcome);
  } catch {
    return false;
  }
}

export function assessPlanCompletion(rootDir: string, plan: PlanEntry): PlanAssessment {
  const { files, missingOwnedPaths } = resolveOwnedFiles(rootDir, plan.ownedPaths);
  const evidence = plan.doneWhen.map((outcome) => {
    const matchingPaths = files
      .filter((filePath) => fileContainsEvidence(rootDir, filePath, outcome))
      .map((filePath) => relativeRepoPath(rootDir, filePath));

    return {
      outcome,
      matched: matchingPaths.length > 0,
      matchingPaths,
    } satisfies DoneWhenEvidence;
  });

  const matchedCount = evidence.filter((entry) => entry.matched).length;
  let classification: PlanAssessment['classification'];

  if (evidence.length === 0 || files.length === 0 || missingOwnedPaths.length > 0) {
    classification = 'ambiguous';
  } else if (matchedCount === evidence.length) {
    classification = 'complete';
  } else if (matchedCount === 0) {
    classification = 'incomplete';
  } else {
    classification = 'ambiguous';
  }

  return {
    classification,
    missingOwnedPaths,
    inspectedFiles: files.map((filePath) => relativeRepoPath(rootDir, filePath)),
    evidence,
  };
}

export function runEnvironmentPreflight(rootDir: string, planPath: string): EnvironmentPreflight {
  const scripts = parsePackageScripts(rootDir);
  const issues: string[] = [];
  const writable = isWritable(rootDir) && isWritable(planPath);

  if (!writable) {
    issues.push('Repository or lane file is not writable.');
  }

  const bunCheck = spawnSync('bun', ['--version'], { cwd: rootDir, encoding: 'utf8' });
  if (bunCheck.status !== 0) {
    issues.push('Bun is not available on PATH.');
  }

  if (!scripts['validate:smoke']) {
    issues.push('package.json is missing a validate:smoke script.');
  }
  if (!scripts.test) {
    issues.push('package.json is missing a test script.');
  }
  if (scripts.test?.includes('vitest')) {
    const vitestBinary = join(rootDir, 'node_modules', '.bin', 'vitest');
    if (!existsSync(vitestBinary)) {
      issues.push('vitest is not installed in node_modules/.bin.');
    }
  }

  return {
    ok: issues.length === 0,
    writable,
    validationReady: issues.length === 0,
    validationCommand: DEFAULT_VALIDATION_COMMAND,
    issues,
  };
}

function replaceFrontmatterScalar(content: string, key: string, value: string): string {
  const pattern = new RegExp(`(^${key}:\\s*).*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${value}`);
  }
  return content.replace(/^---\n/, `---\n${key}: ${value}\n`);
}

function appendAutomationNote(content: string, note: string): string {
  if (content.includes(`\n${AUTOMATION_NOTES_HEADING}\n`)) {
    return `${content.trimEnd()}\n- ${note}\n`;
  }

  return `${content.trimEnd()}\n\n${AUTOMATION_NOTES_HEADING}\n\n- ${note}\n`;
}

function updatePlanStatus(planPath: string, status: string, note: string): void {
  const today = new Date().toISOString().slice(0, 10);
  let next = readFileSync(planPath, 'utf8');
  next = replaceFrontmatterScalar(next, 'status', status);
  next = replaceFrontmatterScalar(next, 'updated', today);
  next = appendAutomationNote(next, note);
  writeFileSync(planPath, next);
}

function resolveCodexHome(rootDir: string, explicitCodexHome?: string): string {
  const envCodexHome = process.env.CODEX_HOME?.trim();
  if (explicitCodexHome) {
    return resolve(explicitCodexHome);
  }
  if (envCodexHome) {
    return resolve(envCodexHome);
  }
  return resolve(rootDir, '.codex');
}

function ensureAutomationMemory(
  rootDir: string,
  automationId: string,
  codexHome?: string,
): { path: string; created: boolean } {
  const baseDir = join(resolveCodexHome(rootDir, codexHome), 'automations', automationId);
  const memoryPath = join(baseDir, 'memory.md');
  const created = !existsSync(memoryPath);

  mkdirSync(baseDir, { recursive: true });
  if (created) {
    writeFileSync(memoryPath, `# ${automationId} memory\n\n`);
  }

  return { path: memoryPath, created };
}

function appendMemoryLine(memoryPath: string, line: string): void {
  appendFileSync(memoryPath, `- ${new Date().toISOString()} ${line}\n`);
}

function isFeatureImplementationComplete(plans: PlanEntry[], feature: string): boolean {
  const implementationPlans = plans.filter(
    (plan) => plan.feature === feature && isImplementationLane(plan.lane),
  );

  return (
    implementationPlans.length > 0 &&
    implementationPlans.every((plan) => COMPLETE_PLAN_STATUSES.has(plan.status))
  );
}

function createGitBranch(
  rootDir: string,
  branchName: string,
): { created: boolean; error?: string } {
  const branchNames = getGitBranches(rootDir);
  if (branchNames.has(branchName)) {
    return { created: false };
  }

  const result = spawnSync('git', ['branch', branchName], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return {
      created: false,
      error: (result.stderr || result.stdout || 'git branch failed').trim(),
    };
  }

  return { created: true };
}

function buildInboxItem(plan: PlanEntry, reason: 'ambiguous' | 'environment'): InboxItem {
  if (reason === 'ambiguous') {
    return {
      title: `${plan.feature} ${plan.lane} lane needs review`,
      summary: 'Mixed done_when evidence blocked stale-lane reconciliation',
    };
  }

  return {
    title: `${plan.feature} ${plan.lane} lane blocked`,
    summary: 'Validation tooling is unavailable for safe reconciliation',
  };
}

function getGitBranches(rootDir: string): Set<string> {
  const result = spawnSync(
    'git',
    ['for-each-ref', 'refs/heads', 'refs/remotes', '--format=%(refname:short)'],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0 || !result.stdout) {
    return new Set<string>();
  }

  return new Set(
    result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

export function findLegacyPlans(rootDir = process.cwd()): string[] {
  const plansRoot = resolve(rootDir, PLAN_ROOT);
  if (!existsSync(plansRoot)) {
    return [];
  }

  return readdirSync(plansRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => join(plansRoot, name));
}

export function collectPlans(
  rootDir = process.cwd(),
  branchNames = getGitBranches(rootDir),
): PlanEntry[] {
  const featureRoot = resolve(rootDir, FEATURE_ROOT);
  const files = walkFiles(featureRoot).filter((file) => file.endsWith(TODO_SUFFIX));
  const parsed = files.map((file) => {
    const content = readFileSync(file, 'utf8');
    const { data } = parseFrontmatter(content);
    const feature = asString(data.feature) || basename(dirname(dirname(file)));
    const qaOrder = Number.parseInt(asString(data.qa_order), 10);

    return {
      path: file,
      featureDir: dirname(dirname(file)),
      feature,
      title: asString(data.title),
      lane: asString(data.lane),
      agent: asString(data.agent),
      status: asString(data.status),
      sourceBranch: asString(data.source_branch),
      workBranch: asString(data.work_branch) || undefined,
      skills: asList(data.skills),
      dependsOn: asList(data.depends_on),
      ownedPaths: asList(data.owned_paths),
      doneWhen: asList(data.done_when),
      handoffIn: asString(data.handoff_in) || undefined,
      handoffOut: asString(data.handoff_out) || undefined,
      qaOrder: Number.isNaN(qaOrder) ? undefined : qaOrder,
      updated: asString(data.updated),
      missingDependencies: [],
      blockedBy: [],
      handoffReady: false,
      runnable: false,
    } satisfies PlanEntry;
  });

  const byPath = new Map(parsed.map((plan) => [resolve(plan.path), plan]));

  return parsed.map((plan) => {
    const missingDependencies: string[] = [];
    const blockedBy: string[] = [];

    for (const dependency of plan.dependsOn) {
      const dependencyPath = resolve(dirname(plan.path), dependency);
      if (!existsSync(dependencyPath)) {
        missingDependencies.push(relativeRepoPath(rootDir, dependencyPath));
        continue;
      }

      const dependencyPlan = byPath.get(dependencyPath);
      if (dependencyPlan && !['done', 'archived'].includes(dependencyPlan.status)) {
        blockedBy.push(
          `${relativeRepoPath(rootDir, dependencyPath)} (${dependencyPlan.status || 'unknown'})`,
        );
      }
    }

    const handoffReady = !plan.handoffIn || branchNames.has(plan.handoffIn);
    return {
      ...plan,
      missingDependencies,
      blockedBy,
      handoffReady,
      runnable:
        plan.status === 'ready' &&
        missingDependencies.length === 0 &&
        blockedBy.length === 0 &&
        handoffReady,
    };
  });
}

export function filterPlans(plans: PlanEntry[], options: FilterOptions): PlanEntry[] {
  return plans.filter((plan) => {
    if (options.agent && plan.agent !== options.agent) {
      return false;
    }
    if (options.lane && !options.lane.includes(plan.lane)) {
      return false;
    }
    if (options.status && plan.status !== options.status) {
      return false;
    }
    if (options.runnable && !plan.runnable) {
      return false;
    }
    if (options.handoffReady) {
      if (!plan.handoffIn) {
        return false;
      }
      if (!plan.handoffReady) {
        return false;
      }
    }
    return true;
  });
}

export function validateFeaturePlans(rootDir = process.cwd()): ValidationResult {
  const featureRoot = resolve(rootDir, FEATURE_ROOT);
  const featureDirs = existsSync(featureRoot)
    ? readdirSync(featureRoot)
        .map((name) => join(featureRoot, name))
        .filter((path) => statSync(path).isDirectory())
    : [];

  const allowedAgents = new Set(['claude', 'codex']);
  const allowedLanes = new Set(['ui', 'state', 'api', 'contracts', 'docs', 'qa']);
  const allowedStatuses = new Set([
    'backlog',
    'ready',
    'in_progress',
    'blocked',
    'in_review',
    'done',
    'archived',
  ]);

  const issues: string[] = [];
  const legacyPlans = findLegacyPlans(rootDir);
  let planCount = 0;

  for (const featureDir of featureDirs) {
    const featureSlug = basename(featureDir);
    const specPath = join(featureDir, 'spec.md');
    if (!existsSync(specPath)) {
      issues.push(`${relativeRepoPath(rootDir, specPath)}: missing spec.md`);
    }

    const todoFiles = walkFiles(featureDir).filter((file) => file.endsWith(TODO_SUFFIX));
    planCount += todoFiles.length;

    for (const file of todoFiles) {
      const content = readFileSync(file, 'utf8');
      const { data } = parseFrontmatter(content);
      const rel = relativeRepoPath(rootDir, file);
      const requiredKeys = [
        'feature',
        'title',
        'lane',
        'agent',
        'status',
        'source_branch',
        'updated',
      ];

      for (const key of requiredKeys) {
        if (!data[key]) {
          issues.push(`${rel}: missing frontmatter key "${key}"`);
        }
      }

      const feature = asString(data.feature);
      const lane = asString(data.lane);
      const agent = asString(data.agent);
      const status = asString(data.status);
      const ownedPaths = asList(data.owned_paths);
      const doneWhen = asList(data.done_when);

      if (feature && feature !== featureSlug) {
        issues.push(`${rel}: feature "${feature}" does not match directory "${featureSlug}"`);
      }
      if (lane && !allowedLanes.has(lane)) {
        issues.push(`${rel}: invalid lane "${lane}"`);
      }
      if (agent && !allowedAgents.has(agent)) {
        issues.push(`${rel}: invalid agent "${agent}"`);
      }
      if (status && !allowedStatuses.has(status)) {
        issues.push(`${rel}: invalid status "${status}"`);
      }
      if (lane === 'qa' && !data.qa_order) {
        issues.push(`${rel}: qa lane requires qa_order`);
      }
      if (agent && !basename(file).includes(agent)) {
        issues.push(`${rel}: filename should include agent "${agent}"`);
      }
      if (isImplementationLane(lane) && ownedPaths.length === 0) {
        issues.push(`${rel}: implementation lane requires owned_paths`);
      }
      if (isImplementationLane(lane) && doneWhen.length === 0) {
        issues.push(`${rel}: implementation lane requires done_when`);
      }

      for (const dependency of asList(data.depends_on)) {
        const dependencyPath = resolve(dirname(file), dependency);
        if (!existsSync(dependencyPath)) {
          issues.push(
            `${rel}: dependency does not exist -> ${relativeRepoPath(rootDir, dependencyPath)}`,
          );
        }
      }

      const handoffIn = asString(data.handoff_in);
      const handoffOut = asString(data.handoff_out);
      for (const handoff of [handoffIn, handoffOut]) {
        if (handoff && !handoff.startsWith('handoff/')) {
          issues.push(`${rel}: handoff branch must start with "handoff/" -> ${handoff}`);
        }
      }
    }
  }

  return {
    featureCount: featureDirs.length,
    legacyPlanCount: legacyPlans.length,
    legacyPlans: legacyPlans.map((path) => relativeRepoPath(rootDir, path)),
    planCount,
    issues,
  };
}

export function scaffoldFeature(
  featureSlug: string,
  options: { rootDir?: string; title?: string; branch?: string } = {},
): string {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const templateDir = resolve(rootDir, TEMPLATE_ROOT);
  const targetDir = resolve(rootDir, FEATURE_ROOT, featureSlug);

  if (!existsSync(templateDir)) {
    throw new Error(`Template directory missing: ${relativeRepoPath(rootDir, templateDir)}`);
  }
  if (existsSync(targetDir)) {
    throw new Error(`Feature already exists: ${relativeRepoPath(rootDir, targetDir)}`);
  }

  cpSync(templateDir, targetDir, {
    recursive: true,
    force: false,
    errorOnExist: true,
  });

  const today = new Date().toISOString().slice(0, 10);
  const replacements = new Map<string, string>([
    ['<feature-slug>', featureSlug],
    ['<Feature Title>', options.title ?? featureSlug],
    ['<source-branch>', options.branch ?? `feature/${featureSlug}`],
    ['<YYYY-MM-DD>', today],
  ]);

  for (const file of walkFiles(targetDir)) {
    const content = readFileSync(file, 'utf8');
    let next = content;
    for (const [placeholder, value] of replacements) {
      next = next.split(placeholder).join(value);
    }
    writeFileSync(file, next);
  }

  return targetDir;
}

export function reconcileQueue(options: ReconcileOptions = {}): ReconcileResult {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const agent = options.agent ?? 'codex';
  const plans = filterPlans(collectPlans(rootDir), {
    agent,
    lane: options.lane ?? resolveDefaultLanes(agent, 'reconcile'),
    status: 'ready',
    runnable: true,
  });

  let memoryPath: string | undefined;
  let memoryCreated = false;
  if (options.automationId) {
    const memory = ensureAutomationMemory(rootDir, options.automationId, options.codexHome);
    memoryPath = memory.path;
    memoryCreated = memory.created;
  }

  const result: ReconcileResult = {
    action: 'noop',
    memoryPath,
    memoryCreated,
    createdBranches: [],
    inspected: [],
  };

  if (plans.length === 0) {
    if (memoryPath) {
      appendMemoryLine(memoryPath, 'No runnable implementation lanes were available.');
    }
    return result;
  }

  for (const plan of plans) {
    const preflight = runEnvironmentPreflight(rootDir, plan.path);
    if (!preflight.ok) {
      const note = `Blocked before reconciliation: ${preflight.issues.join(' ')}`;
      result.action = 'blocked';
      result.inboxItem = buildInboxItem(plan, 'environment');
      result.inspected.push({
        path: plan.path,
        feature: plan.feature,
        lane: plan.lane,
        classification: 'environment_blocked',
        statusBefore: plan.status,
        statusAfter: plan.status,
        note,
        preflight,
      });
      if (memoryPath) {
        appendMemoryLine(memoryPath, `${relativeRepoPath(rootDir, plan.path)} environment blocked`);
      }
      return result;
    }

    const assessment = assessPlanCompletion(rootDir, plan);
    if (assessment.classification === 'complete') {
      const matchedCount = assessment.evidence.filter((entry) => entry.matched).length;
      const note = `Reconciled as done by automation; matched ${matchedCount}/${assessment.evidence.length} done_when checks under owned_paths.`;
      result.inspected.push({
        path: plan.path,
        feature: plan.feature,
        lane: plan.lane,
        classification: 'complete',
        statusBefore: plan.status,
        statusAfter: options.write ? 'done' : plan.status,
        note,
        evidence: assessment.evidence,
      });

      if (options.write) {
        updatePlanStatus(plan.path, 'done', note);
        if (memoryPath) {
          appendMemoryLine(memoryPath, `${relativeRepoPath(rootDir, plan.path)} marked done`);
        }

        const refreshedPlans = collectPlans(rootDir);
        if (isFeatureImplementationComplete(refreshedPlans, plan.feature)) {
          const branchName = `handoff/qa-claude/${plan.feature}`;
          const branchResult = createGitBranch(rootDir, branchName);
          if (branchResult.created) {
            result.createdBranches.push(branchName);
            if (memoryPath) {
              appendMemoryLine(memoryPath, `Created ${branchName}`);
            }
          } else if (branchResult.error && memoryPath) {
            appendMemoryLine(memoryPath, `Failed to create ${branchName}: ${branchResult.error}`);
          }
        }
      }

      continue;
    }

    if (assessment.classification === 'ambiguous') {
      const note =
        'Marked blocked by automation; partial done_when evidence found under owned_paths.';
      result.action = 'blocked';
      result.inboxItem = buildInboxItem(plan, 'ambiguous');
      result.inspected.push({
        path: plan.path,
        feature: plan.feature,
        lane: plan.lane,
        classification: 'ambiguous',
        statusBefore: plan.status,
        statusAfter: options.write ? 'blocked' : plan.status,
        note,
        evidence: assessment.evidence,
      });

      if (options.write) {
        updatePlanStatus(plan.path, 'blocked', note);
      }
      if (memoryPath) {
        appendMemoryLine(memoryPath, `${relativeRepoPath(rootDir, plan.path)} marked blocked`);
      }
      return result;
    }

    const note = 'Selected for implementation after reconciliation preflight.';
    result.action = 'implement';
    result.selectedPlanPath = plan.path;
    result.selectedFeature = plan.feature;
    result.inspected.push({
      path: plan.path,
      feature: plan.feature,
      lane: plan.lane,
      classification: 'incomplete',
      statusBefore: plan.status,
      statusAfter: plan.status,
      note,
      evidence: assessment.evidence,
    });
    if (memoryPath) {
      appendMemoryLine(
        memoryPath,
        `${relativeRepoPath(rootDir, plan.path)} selected for implementation`,
      );
    }
    return result;
  }

  if (memoryPath) {
    appendMemoryLine(
      memoryPath,
      'Reconciled all runnable implementation lanes without selecting new work.',
    );
  }
  return result;
}

function printPlans(plans: PlanEntry[], rootDir: string): void {
  if (plans.length === 0) {
    console.log('No matching plans.');
    return;
  }

  for (const plan of plans) {
    console.log(
      `${plan.feature} | ${plan.agent}/${plan.lane} | ${plan.status} | ${relativeRepoPath(rootDir, plan.path)}`,
    );
    if (plan.workBranch) {
      console.log(`  work_branch: ${plan.workBranch}`);
    }
    if (plan.handoffIn) {
      console.log(`  handoff_in: ${plan.handoffIn} (${plan.handoffReady ? 'ready' : 'missing'})`);
    }
    if (plan.blockedBy.length > 0) {
      console.log(`  blocked_by: ${plan.blockedBy.join(', ')}`);
    }
    if (plan.missingDependencies.length > 0) {
      console.log(`  missing_dependencies: ${plan.missingDependencies.join(', ')}`);
    }
  }
}

function parseArgs(argv: string[]): {
  command: string;
  positionals: string[];
  options: Record<string, string | boolean>;
} {
  const [command = 'list', ...rest] = argv;
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, positionals, options };
}

function parseLaneOption(value: string | boolean | undefined): string[] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function main(): number {
  const { command, positionals, options } = parseArgs(process.argv.slice(2));
  const rootDir = resolve(typeof options.root === 'string' ? options.root : process.cwd());

  if (command === 'scaffold') {
    const [featureSlug] = positionals;
    if (!featureSlug) {
      console.error(
        'Usage: bun run plans scaffold <feature-slug> [--title "..."] [--branch "..."]',
      );
      return 1;
    }

    const targetDir = scaffoldFeature(featureSlug, {
      rootDir,
      title: typeof options.title === 'string' ? options.title : undefined,
      branch: typeof options.branch === 'string' ? options.branch : undefined,
    });
    console.log(`Created ${relativeRepoPath(rootDir, targetDir)}`);
    return 0;
  }

  if (command === 'validate') {
    const result = validateFeaturePlans(rootDir);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.issues.length === 0) {
      console.log(
        `Validated ${result.planCount} plan files across ${result.featureCount} feature packs. No issues.`,
      );
      if (result.legacyPlanCount > 0) {
        console.log(
          `Legacy note: ${result.legacyPlanCount} flat plan files remain outside .plans/features and will not appear in automation queues until migrated.`,
        );
      }
    } else {
      console.error(
        `Validation failed for ${result.planCount} plan files across ${result.featureCount} feature packs:`,
      );
      for (const issue of result.issues) {
        console.error(`- ${issue}`);
      }
    }
    return result.issues.length === 0 ? 0 : 1;
  }

  if (command === 'legacy') {
    const legacyPlans = findLegacyPlans(rootDir).map((path) => relativeRepoPath(rootDir, path));
    if (options.json) {
      console.log(JSON.stringify(legacyPlans, null, 2));
      return 0;
    }
    if (legacyPlans.length === 0) {
      console.log('No legacy flat plans.');
      return 0;
    }
    for (const plan of legacyPlans) {
      console.log(plan);
    }
    return 0;
  }

  if (command === 'reconcile') {
    const result = reconcileQueue({
      rootDir,
      agent: typeof options.agent === 'string' ? options.agent : 'codex',
      lane: parseLaneOption(options.lane),
      automationId:
        typeof options['automation-id'] === 'string' ? options['automation-id'] : undefined,
      codexHome: typeof options['codex-home'] === 'string' ? options['codex-home'] : undefined,
      write: options.write === true,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`action: ${result.action}`);
      if (result.selectedPlanPath) {
        console.log(`selected: ${relativeRepoPath(rootDir, result.selectedPlanPath)}`);
      }
      if (result.memoryPath) {
        console.log(`memory: ${relativeRepoPath(rootDir, result.memoryPath)}`);
      }
      for (const branchName of result.createdBranches) {
        console.log(`created_branch: ${branchName}`);
      }
      if (result.inboxItem) {
        console.log(`inbox_title: ${result.inboxItem.title}`);
        console.log(`inbox_summary: ${result.inboxItem.summary}`);
      }
    }

    return result.action === 'blocked' ? 1 : 0;
  }

  const plans = collectPlans(rootDir);
  const requestedLanes = parseLaneOption(options.lane);
  const agent = typeof options.agent === 'string' ? options.agent : undefined;
  const defaultLanes = !requestedLanes ? resolveDefaultLanes(agent, command) : undefined;
  const filters: FilterOptions = {
    agent,
    lane: requestedLanes ?? defaultLanes,
    status: typeof options.status === 'string' ? options.status : undefined,
    runnable: command === 'queue' || options.runnable === true,
    handoffReady: options['handoff-ready'] === true,
  };

  if (command === 'queue' && !filters.status) {
    filters.status = 'ready';
  }

  const filtered = filterPlans(plans, filters);
  if (options.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return 0;
  }

  printPlans(filtered, rootDir);
  if (filtered.length === 0) {
    const legacyPlans = findLegacyPlans(rootDir);
    if (legacyPlans.length > 0) {
      console.log(
        `Legacy note: ${legacyPlans.length} flat plan files remain in .plans/ and are not included in this queue. Run \`bun run plans legacy\` to list them.`,
      );
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exitCode = main();
}
