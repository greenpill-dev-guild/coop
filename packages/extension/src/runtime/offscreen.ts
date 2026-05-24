import type { RuntimeActionResponse } from './messages';

let receiverRuntimePromise: Promise<unknown> | null = null;
let coopRuntimePromise: Promise<unknown> | null = null;

function loadReceiverRuntime() {
  receiverRuntimePromise ??= import('./receiver-sync-offscreen');
  return receiverRuntimePromise;
}

function loadCoopRuntime() {
  coopRuntimePromise ??= import('./coop-sync-offscreen');
  return coopRuntimePromise;
}

async function shouldLoadReceiverRuntime() {
  const response = (await chrome.runtime.sendMessage({
    type: 'get-receiver-sync-config',
  })) as RuntimeActionResponse<{ pairings: unknown[] }>;
  return response.ok && (response.data?.pairings.length ?? 0) > 0;
}

async function shouldLoadCoopRuntime() {
  const response = (await chrome.runtime.sendMessage({
    type: 'get-coop-sync-config',
  })) as RuntimeActionResponse<{ coops: Array<{ roomSecretAvailable?: boolean }> }>;
  return response.ok && (response.data?.coops.some((entry) => entry.roomSecretAvailable) ?? false);
}

async function runPendingAgentCycle(message: {
  payload?: { reason?: string; force?: boolean };
}) {
  const { runAgentCycle } = await import('./agent/runner');
  await runAgentCycle({
    force: message.payload?.force === true,
    reason: message.payload?.reason ?? 'offscreen-message',
  });
}

chrome.runtime.onMessage.addListener((message: { type?: string; payload?: unknown }) => {
  if (message.type === 'refresh-receiver-bindings') {
    void loadReceiverRuntime();
    return;
  }
  if (message.type === 'refresh-coop-sync-bindings') {
    void loadCoopRuntime();
    return;
  }
  if (message.type === 'run-agent-cycle-if-pending') {
    void loadReceiverRuntime().then(() =>
      runPendingAgentCycle(message as { payload?: { reason?: string; force?: boolean } }),
    );
    return;
  }
  if (message.type === 'teardown-agent-models') {
    void import('./agent/models').then(({ teardownAgentModelRuntimes }) => {
      teardownAgentModelRuntimes();
    });
  }
});

void shouldLoadReceiverRuntime()
  .then((hasWork) => {
    if (hasWork) return loadReceiverRuntime();
  })
  .catch(() => undefined);

void shouldLoadCoopRuntime()
  .then((hasWork) => {
    if (hasWork) return loadCoopRuntime();
  })
  .catch(() => undefined);
