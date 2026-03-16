import {
  type ReceiverCapture,
  type ReceiverSyncEnvelope,
  buildIceServers,
  connectReceiverSyncProviders,
  connectReceiverSyncRelay,
  createReceiverSyncDoc,
  createReceiverSyncRelayAck,
  listReceiverSyncEnvelopeIssues,
  listReceiverSyncEnvelopes,
  markReceiverCaptureSyncFailed,
  patchReceiverSyncEnvelope,
} from '@coop/shared';
import { AGENT_LOOP_POLL_INTERVAL_MS } from './agent-config';
import { runAgentCycle } from './agent-runner';
import type {
  ReceiverSyncConfigResponse,
  ReceiverSyncRuntimeStatus,
  RuntimeActionResponse,
} from './messages';

type ReceiverBinding = {
  key: string;
  doc: ReturnType<typeof createReceiverSyncDoc>;
  relay?: ReturnType<typeof connectReceiverSyncRelay>;
  transport: NonNullable<ReceiverSyncRuntimeStatus['transport']>;
  disconnect: () => void;
  processingIds: Set<string>;
  reportedIssues: Set<string>;
  timer?: number;
};

const pollIntervalMs = 1500;
const bindings = new Map<string, ReceiverBinding>();
let refreshPromise: Promise<void> | null = null;

function runtimeNow() {
  return new Date().toISOString();
}

function hasRtcPeerConnection() {
  return (
    typeof globalThis.RTCPeerConnection !== 'undefined' ||
    typeof (globalThis as typeof globalThis & { webkitRTCPeerConnection?: unknown })
      .webkitRTCPeerConnection !== 'undefined'
  );
}

async function reportReceiverSyncRuntime(patch: Partial<ReceiverSyncRuntimeStatus>) {
  try {
    await chrome.runtime.sendMessage({
      type: 'report-receiver-sync-runtime',
      payload: patch,
    });
  } catch {
    // Ignore reporting failures so the sync runtime stays best-effort.
  }
}

function buildBindingKey(pairing: ReceiverSyncConfigResponse['pairings'][number]) {
  return `${pairing.roomId}:${pairing.signalingUrls.join('|')}`;
}

function resolveBindingTransport(input: {
  webrtcEnabled: boolean;
  relayConfigured: boolean;
}): NonNullable<ReceiverSyncRuntimeStatus['transport']> {
  if (input.webrtcEnabled) {
    return 'webrtc';
  }

  if (input.relayConfigured) {
    return 'websocket';
  }

  return 'indexeddb-only';
}

async function fetchReceiverSyncConfig() {
  const response = (await chrome.runtime.sendMessage({
    type: 'get-receiver-sync-config',
  })) as RuntimeActionResponse<ReceiverSyncConfigResponse>;

  if (!response.ok || !response.data) {
    throw new Error(response.error ?? 'Could not load receiver sync config.');
  }

  return response.data.pairings;
}

function scheduleProcessQueue(
  binding: ReceiverBinding,
  processQueue: () => Promise<void>,
  delay = 0,
) {
  if (binding.timer) {
    window.clearTimeout(binding.timer);
  }
  binding.timer = window.setTimeout(() => {
    void processQueue();
  }, delay);
}

function createBinding(pairing: ReceiverSyncConfigResponse['pairings'][number]) {
  const doc = createReceiverSyncDoc();
  const iceServers = buildIceServers({
    urls: import.meta.env.VITE_COOP_TURN_URLS,
    username: import.meta.env.VITE_COOP_TURN_USERNAME,
    credential: import.meta.env.VITE_COOP_TURN_CREDENTIAL,
  });
  const providers = connectReceiverSyncProviders(
    doc,
    pairing.roomId,
    pairing.signalingUrls,
    undefined,
    iceServers,
  );
  const relayTransport = resolveBindingTransport({
    webrtcEnabled: Boolean(providers.webrtc),
    relayConfigured: false,
  });
  const binding: ReceiverBinding = {
    key: buildBindingKey(pairing),
    doc,
    transport: relayTransport,
    processingIds: new Set(),
    reportedIssues: new Set(),
    disconnect() {
      if (binding.timer) {
        window.clearTimeout(binding.timer);
      }
      doc.off('update', onDocUpdate);
      binding.relay?.disconnect();
      providers.disconnect();
      void reportReceiverSyncRuntime({
        lastBindingDisconnectedAt: runtimeNow(),
        activeBindingKeys: [...bindings.values()]
          .filter((candidate) => candidate.key !== binding.key)
          .map((candidate) => candidate.key),
      });
    },
  };
  const ingestEnvelope = async (
    envelope: ReceiverSyncEnvelope,
    options: {
      patchDoc?: boolean;
    } = {},
  ) => {
    if (
      envelope.capture.pairingId !== pairing.pairingId ||
      envelope.capture.syncState !== 'queued' ||
      binding.processingIds.has(envelope.capture.id)
    ) {
      return null;
    }

    binding.processingIds.add(envelope.capture.id);

    try {
      void reportReceiverSyncRuntime({
        lastIngestAttemptAt: runtimeNow(),
        lastError: undefined,
      });
      const response = (await chrome.runtime.sendMessage({
        type: 'ingest-receiver-capture',
        payload: envelope,
      })) as RuntimeActionResponse<ReceiverCapture>;

      if (response.ok && response.data) {
        void reportReceiverSyncRuntime({
          lastIngestSuccessAt: runtimeNow(),
          lastError: undefined,
        });
        if (options.patchDoc) {
          patchReceiverSyncEnvelope(doc, envelope.capture.id, (current) => ({
            ...current,
            capture: {
              ...current.capture,
              ...response.data,
            },
          }));
        }
        return {
          ok: true,
          capture: response.data,
        } as const;
      }

      const failedCapture = markReceiverCaptureSyncFailed(
        envelope.capture,
        response.error ?? 'Receiver sync failed.',
      );
      void reportReceiverSyncRuntime({
        lastError: response.error ?? 'Receiver sync failed.',
      });
      if (options.patchDoc) {
        patchReceiverSyncEnvelope(doc, envelope.capture.id, (current) => ({
          ...current,
          capture: failedCapture,
        }));
      }
      return {
        ok: false,
        capture: failedCapture,
        error: response.error ?? 'Receiver sync failed.',
      } as const;
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'Receiver sync failed before completion.';
      const failedCapture = markReceiverCaptureSyncFailed(envelope.capture, failureMessage);
      void reportReceiverSyncRuntime({
        lastError: failureMessage,
      });
      if (options.patchDoc) {
        patchReceiverSyncEnvelope(doc, envelope.capture.id, (current) => ({
          ...current,
          capture: failedCapture,
        }));
      }
      return {
        ok: false,
        capture: failedCapture,
        error: failureMessage,
      } as const;
    } finally {
      binding.processingIds.delete(envelope.capture.id);
    }
  };

  binding.relay = connectReceiverSyncRelay({
    roomId: pairing.roomId,
    signalingUrls: pairing.signalingUrls,
    onCapture: async (frame) => {
      if (frame.pairingId !== pairing.pairingId || frame.roomId !== pairing.roomId) {
        return;
      }

      const result = await ingestEnvelope(frame.envelope);
      if (!result) {
        return;
      }

      binding.relay?.publishAck(
        await createReceiverSyncRelayAck({
          pairing,
          requestId: frame.messageId,
          capture: result.capture,
          ok: result.ok,
          error: result.error,
          sourceClientId: `extension-offscreen:${pairing.pairingId}`,
        }),
      );
    },
    onError: (error) => {
      void reportReceiverSyncRuntime({
        lastError: error.message,
      });
    },
  });
  binding.transport = resolveBindingTransport({
    webrtcEnabled: Boolean(providers.webrtc),
    relayConfigured: binding.relay.configured,
  });

  void reportReceiverSyncRuntime({
    lastBindingCreatedAt: runtimeNow(),
    transport: binding.transport,
    hasWebSocket: typeof WebSocket !== 'undefined',
    hasRtcPeerConnection: hasRtcPeerConnection(),
  });

  const processQueue = async () => {
    const envelopes = listReceiverSyncEnvelopes(doc);
    void reportReceiverSyncRuntime({
      lastRefreshedAt: runtimeNow(),
      lastEnvelopeCount: envelopes.length,
    });

    for (const issue of listReceiverSyncEnvelopeIssues(doc)) {
      const issueKey = `${issue.captureId}:${issue.reason}`;
      if (binding.reportedIssues.has(issueKey)) {
        continue;
      }
      binding.reportedIssues.add(issueKey);
      void reportReceiverSyncRuntime({
        lastError: `Malformed room entry ${issue.captureId}: ${issue.reason}`,
      });
    }

    for (const envelope of envelopes) {
      await ingestEnvelope(envelope, { patchDoc: true });
    }
  };

  const onDocUpdate = () => {
    void reportReceiverSyncRuntime({
      lastDocUpdateAt: runtimeNow(),
    });
    scheduleProcessQueue(binding, processQueue, 180);
  };

  doc.on('update', onDocUpdate);
  scheduleProcessQueue(binding, processQueue, 900);
  return binding;
}

async function refreshBindings() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const pairings = await fetchReceiverSyncConfig();
    const nextBindings = new Map(
      pairings.map((pairing) => [pairing.pairingId, buildBindingKey(pairing)]),
    );

    for (const [pairingId, binding] of bindings.entries()) {
      if (nextBindings.get(pairingId) !== binding.key) {
        binding.disconnect();
        bindings.delete(pairingId);
      }
    }

    for (const pairing of pairings) {
      if (bindings.has(pairing.pairingId)) {
        continue;
      }
      bindings.set(pairing.pairingId, createBinding(pairing));
    }
    await reportReceiverSyncRuntime({
      lastRefreshedAt: runtimeNow(),
      activePairingIds: pairings.map((pairing) => pairing.pairingId),
      activeBindingKeys: [...bindings.values()].map((binding) => binding.key),
      hasWebSocket: typeof WebSocket !== 'undefined',
      hasRtcPeerConnection: hasRtcPeerConnection(),
      transport: [...bindings.values()][0]?.transport ?? 'none',
    });
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

void reportReceiverSyncRuntime({
  loadedAt: runtimeNow(),
  activePairingIds: [],
  activeBindingKeys: [],
  transport: 'none',
  hasWebSocket: typeof WebSocket !== 'undefined',
  hasRtcPeerConnection: hasRtcPeerConnection(),
});
void refreshBindings();
window.setInterval(() => {
  void refreshBindings();
}, pollIntervalMs);
window.setInterval(() => {
  void runAgentCycle();
}, AGENT_LOOP_POLL_INTERVAL_MS);

window.addEventListener('unload', () => {
  for (const binding of bindings.values()) {
    binding.disconnect();
  }
  bindings.clear();
});
