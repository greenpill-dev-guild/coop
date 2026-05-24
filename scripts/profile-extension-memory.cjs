#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const {
  ensureExtensionBuilt,
  extensionDir,
  rootDir,
} = require('../e2e/helpers/extension-build.cjs');

const defaultDurationMs = 10 * 60 * 1000;
const defaultSampleMs = 5000;
const bytesPerMb = 1024 * 1024;

function parseArgs(argv) {
  const args = {
    profile: 'idle',
    durationMs: defaultDurationMs,
    sampleMs: defaultSampleMs,
    includeLocalModels: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--profile') args.profile = argv[++index] ?? args.profile;
    else if (value === '--duration') args.durationMs = parseDuration(argv[++index]);
    else if (value === '--sample-ms') args.sampleMs = Number(argv[++index] ?? args.sampleMs);
    else if (value === '--include-local-models') args.includeLocalModels = true;
  }

  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) {
    throw new Error('Invalid --duration value.');
  }
  if (!Number.isFinite(args.sampleMs) || args.sampleMs <= 0) {
    throw new Error('Invalid --sample-ms value.');
  }
  if (!['idle', 'sidepanel', 'sync', 'capture', 'agent', 'all'].includes(args.profile)) {
    throw new Error(`Unknown --profile "${args.profile}".`);
  }
  return args;
}

function parseDuration(raw) {
  if (!raw) return defaultDurationMs;
  const match = String(raw).match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/);
  if (!match) throw new Error(`Invalid duration "${raw}". Use values like 90s, 10m, or 5000ms.`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 'ms';
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 's') return amount * 1000;
  return amount;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function launchExtensionProfile() {
  ensureExtensionBuilt();
  const userDataDir = path.join(os.tmpdir(), `coop-extension-memory-${Date.now()}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const browserSession = await context.browser().newBrowserCDPSession();
  return { context, worker, extensionId, browserSession };
}

async function sendRuntimeMessage(env, message) {
  const page = await env.context.newPage();
  try {
    await page.goto(`chrome-extension://${env.extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
    return await page.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function getPerformanceDiagnostics(worker) {
  return worker.evaluate(async () => {
    const hook = globalThis.__coopPerformanceDiagnostics;
    if (typeof hook !== 'function') {
      return {
        ok: false,
        error: 'Service worker diagnostics hook is unavailable.',
      };
    }
    return {
      ok: true,
      data: await hook(),
    };
  });
}

async function prepareProfile(profile, env) {
  if (profile === 'idle') return;

  if (profile === 'sidepanel' || profile === 'sync' || profile === 'all') {
    const page = await env.context.newPage();
    await page.goto(`chrome-extension://${env.extensionId}/sidepanel.html`);
  }

  if (profile === 'capture' || profile === 'all') {
    const pages = [];
    for (let index = 0; index < 10; index += 1) {
      const page = await env.context.newPage();
      await page.goto(
        `data:text/html,<title>Coop memory profile ${index}</title><main>Profile tab ${index}</main>`,
      );
      pages.push(page);
    }
    await sendRuntimeMessage(env, { type: 'manual-capture' }).catch(() => undefined);
  }

  if (profile === 'agent' || profile === 'all') {
    if (!env.includeLocalModels) {
      await sendRuntimeMessage(env, {
        type: 'set-local-inference-opt-in',
        payload: { enabled: false },
      }).catch(() => undefined);
    }
    await sendRuntimeMessage(env, { type: 'run-agent-cycle' }).catch(() => undefined);
  }
}

async function getWorkerHeap(worker) {
  return worker
    .evaluate(() => {
      const memory = performance.memory;
      if (!memory) return null;
      return {
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        totalJSHeapSize: memory.totalJSHeapSize,
        usedJSHeapSize: memory.usedJSHeapSize,
      };
    })
    .catch(() => null);
}

function readProcessRssBytes(pid) {
  try {
    const output = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const rssKb = Number(output);
    return Number.isFinite(rssKb) ? rssKb * 1024 : null;
  } catch {
    return null;
  }
}

async function getSystemProcessInfo(browserSession) {
  const response = await browserSession.send('SystemInfo.getProcessInfo').catch(() => null);
  if (!response?.processInfo) return response;
  const processInfo = response.processInfo.map((process) => ({
    ...process,
    rssBytes: readProcessRssBytes(process.id),
  }));
  const totalRssBytes = processInfo.reduce((sum, process) => sum + (process.rssBytes ?? 0), 0);
  return {
    ...response,
    processInfo,
    totalRssBytes,
  };
}

async function getTargets(browserSession, extensionId) {
  const response = await browserSession
    .send('Target.getTargets')
    .catch(() => ({ targetInfos: [] }));
  return response.targetInfos
    .filter((target) => target.url?.includes(extensionId) || target.type === 'service_worker')
    .map((target) => ({
      targetId: target.targetId,
      type: target.type,
      title: target.title,
      url: target.url,
      attached: target.attached,
    }));
}

async function sample(env, startedAt) {
  const [diagnosticsResponse, workerHeap, processInfo, targets] = await Promise.all([
    getPerformanceDiagnostics(env.worker).catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })),
    getWorkerHeap(env.worker),
    getSystemProcessInfo(env.browserSession),
    getTargets(env.browserSession, env.extensionId),
  ]);

  return {
    sampledAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    workerHeap,
    processInfo,
    targets,
    diagnostics: diagnosticsResponse.ok ? diagnosticsResponse.data : null,
    diagnosticsError: diagnosticsResponse.ok ? undefined : diagnosticsResponse.error,
  };
}

function linearSlopeMbPerMinute(samples) {
  const points = samples
    .map((entry) => ({
      x: entry.elapsedMs / 60000,
      y: (entry.workerHeap?.usedJSHeapSize ?? 0) / bytesPerMb,
    }))
    .filter((entry) => entry.y > 0);
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function linearSlopeMbPerMinuteForSamples(samples, readMb) {
  const points = samples
    .map((entry) => ({
      x: entry.elapsedMs / 60000,
      y: readMb(entry),
    }))
    .filter((entry) => typeof entry.y === 'number');
  if (points.length < 2) return 0;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function summarize(samples, args) {
  const heapValues = samples
    .map((entry) => entry.workerHeap?.usedJSHeapSize)
    .filter((value) => typeof value === 'number');
  const processRssValues = samples
    .map((entry) => entry.processInfo?.totalRssBytes)
    .filter((value) => typeof value === 'number' && value > 0);
  const peakHeap = heapValues.length ? Math.max(...heapValues) : 0;
  const finalHeap = heapValues.at(-1) ?? 0;
  const peakProcessRss = processRssValues.length ? Math.max(...processRssValues) : 0;
  const finalProcessRss = processRssValues.at(-1) ?? 0;
  const warmupMs = Math.min(args.durationMs * 0.5, 30000);
  const warmSamples = samples.filter((entry) => entry.elapsedMs >= warmupMs);
  const heapSlope = linearSlopeMbPerMinute(warmSamples);
  const processRssSlope = linearSlopeMbPerMinuteForSamples(warmSamples, (entry) => {
    const value = entry.processInfo?.totalRssBytes;
    return typeof value === 'number' && value > 0 ? value / bytesPerMb : null;
  });
  const latestDiagnostics = samples.at(-1)?.diagnostics;
  const hasDiagnostics = Boolean(latestDiagnostics);
  const idleBindingsOk =
    args.profile !== 'idle' ||
    (hasDiagnostics &&
      (latestDiagnostics?.receiverSync?.bindingCount ?? 0) === 0 &&
      (latestDiagnostics?.coopSync?.bindingCount ?? 0) === 0);
  const localModelsOk =
    args.includeLocalModels ||
    (hasDiagnostics &&
      !latestDiagnostics.agent.modelStatus.webllm.workerActive &&
      !latestDiagnostics.agent.modelStatus.gemma4.iframeActive &&
      !latestDiagnostics.agent.modelStatus.transformers.ready);
  const slopeForBudget = heapValues.length > 1 ? heapSlope : processRssSlope;
  const slopeOk = args.profile !== 'idle' || slopeForBudget <= 1;
  return {
    profile: args.profile,
    sampleCount: samples.length,
    peakWorkerHeapMb: peakHeap / bytesPerMb,
    finalWorkerHeapMb: finalHeap / bytesPerMb,
    workerHeapSlopeMbPerMinute: heapSlope,
    peakProcessRssMb: peakProcessRss / bytesPerMb,
    finalProcessRssMb: finalProcessRss / bytesPerMb,
    processRssSlopeMbPerMinute: processRssSlope,
    budgets: {
      idleSlopeUnder1MbPerMinute: slopeOk,
      idleHasZeroSyncBindings: idleBindingsOk,
      localInferenceOffHasNoModelRuntime: localModelsOk,
    },
    latestDiagnostics,
  };
}

function writeSummary(summary, outputDir) {
  const lines = [
    '# Coop Extension Memory Profile',
    '',
    `- Profile: ${summary.profile}`,
    `- Samples: ${summary.sampleCount}`,
    `- Peak worker heap: ${summary.peakWorkerHeapMb.toFixed(2)} MB`,
    `- Final worker heap: ${summary.finalWorkerHeapMb.toFixed(2)} MB`,
    `- Worker heap slope: ${summary.workerHeapSlopeMbPerMinute.toFixed(3)} MB/min`,
    `- Peak process RSS: ${summary.peakProcessRssMb.toFixed(2)} MB`,
    `- Final process RSS: ${summary.finalProcessRssMb.toFixed(2)} MB`,
    `- Process RSS slope: ${summary.processRssSlopeMbPerMinute.toFixed(3)} MB/min`,
    '',
    '## Budgets',
    '',
    `- Idle slope under 1 MB/min: ${summary.budgets.idleSlopeUnder1MbPerMinute ? 'PASS' : 'FAIL'}`,
    `- Idle has zero sync bindings: ${summary.budgets.idleHasZeroSyncBindings ? 'PASS' : 'FAIL'}`,
    `- Local inference off has no model runtime: ${
      summary.budgets.localInferenceOffHasNoModelRuntime ? 'PASS' : 'FAIL'
    }`,
    '',
    '## Latest Diagnostics',
    '',
    '```json',
    JSON.stringify(summary.latestDiagnostics ?? null, null, 2),
    '```',
  ];
  fs.writeFileSync(path.join(outputDir, 'summary.md'), `${lines.join('\n')}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.join(rootDir, 'output/performance/extension-memory', nowStamp());
  fs.mkdirSync(outputDir, { recursive: true });
  const samplesPath = path.join(outputDir, 'samples.jsonl');

  const env = await launchExtensionProfile();
  env.includeLocalModels = args.includeLocalModels;
  const samples = [];
  try {
    await prepareProfile(args.profile, env);
    const startedAt = Date.now();
    while (Date.now() - startedAt <= args.durationMs) {
      const entry = await sample(env, startedAt);
      samples.push(entry);
      fs.appendFileSync(samplesPath, `${JSON.stringify(entry)}\n`);
      await sleep(args.sampleMs);
    }
  } finally {
    await env.context.close().catch(() => undefined);
  }

  const summary = summarize(samples, args);
  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeSummary(summary, outputDir);

  const failedBudgets = Object.entries(summary.budgets)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedBudgets.length > 0) {
    throw new Error(`Memory profile budget failed: ${failedBudgets.join(', ')}`);
  }

  console.log(`Memory profile written to ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
