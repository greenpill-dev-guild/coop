import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { defaultIceServers, filterUsableSignalingUrls } from '../../../../signaling/config';
import { type ReceiverSyncEnvelope, receiverSyncEnvelopeSchema } from '../../contracts/schema';

const ROOT_KEY = 'receiver-sync';
const CAPTURES_KEY = 'captures';

export interface ReceiverSyncEnvelopeIssue {
  captureId: string;
  reason: string;
}

function getReceiverCaptureMap(doc: Y.Doc) {
  const root = doc.getMap<Y.Map<string>>(ROOT_KEY);
  let captureMap = root.get(CAPTURES_KEY);

  if (!(captureMap instanceof Y.Map)) {
    const nextCaptureMap = new Y.Map<string>();
    doc.transact(() => {
      root.set(CAPTURES_KEY, nextCaptureMap);
    });
    captureMap = nextCaptureMap;
  }

  return captureMap;
}

export function createReceiverSyncDoc() {
  const doc = new Y.Doc();
  getReceiverCaptureMap(doc);
  return doc;
}

export function listReceiverSyncEnvelopes(doc: Y.Doc) {
  return readReceiverSyncEnvelopes(doc).envelopes;
}

export function listReceiverSyncEnvelopeIssues(doc: Y.Doc) {
  return readReceiverSyncEnvelopes(doc).issues;
}

export function readReceiverSyncEnvelopes(doc: Y.Doc) {
  const captureMap = getReceiverCaptureMap(doc);
  const envelopes: ReceiverSyncEnvelope[] = [];
  const issues: ReceiverSyncEnvelopeIssue[] = [];

  for (const [captureId, value] of captureMap.entries()) {
    try {
      const parsed = receiverSyncEnvelopeSchema.parse(JSON.parse(value));
      envelopes.push(parsed);
    } catch (error) {
      issues.push({
        captureId,
        reason: error instanceof Error ? error.message : 'Receiver sync payload is malformed.',
      });
    }
  }

  envelopes.sort((left, right) => left.capture.createdAt.localeCompare(right.capture.createdAt));
  return {
    envelopes,
    issues,
  };
}

export function upsertReceiverSyncEnvelope(doc: Y.Doc, envelope: ReceiverSyncEnvelope) {
  const captureMap = getReceiverCaptureMap(doc);
  doc.transact(() => {
    captureMap.set(envelope.capture.id, JSON.stringify(envelope));
  });
}

export function patchReceiverSyncEnvelope(
  doc: Y.Doc,
  captureId: string,
  updater: (current: ReceiverSyncEnvelope) => ReceiverSyncEnvelope,
) {
  const captureMap = getReceiverCaptureMap(doc);
  const current = captureMap.get(captureId);
  if (!current) {
    return null;
  }

  let parsed: ReceiverSyncEnvelope;
  try {
    parsed = receiverSyncEnvelopeSchema.parse(JSON.parse(current));
  } catch {
    return null;
  }

  const next = receiverSyncEnvelopeSchema.parse(updater(parsed));
  doc.transact(() => {
    captureMap.set(captureId, JSON.stringify(next));
  });
  return next;
}

export function connectReceiverSyncProviders(
  doc: Y.Doc,
  roomId: string,
  signalingUrls: string[] = [],
  password?: string,
  iceServers?: RTCIceServer[],
) {
  if (typeof window === 'undefined') {
    return {
      roomId,
      indexeddb: undefined,
      webrtc: undefined,
      disconnect() {},
    };
  }

  const indexeddb = new IndexeddbPersistence(roomId, doc);
  let webrtc: WebrtcProvider | undefined;
  const usableSignalingUrls = filterUsableSignalingUrls(signalingUrls);
  const hasWebRtcRuntime =
    typeof globalThis.RTCPeerConnection !== 'undefined' ||
    typeof (globalThis as typeof globalThis & { webkitRTCPeerConnection?: unknown })
      .webkitRTCPeerConnection !== 'undefined';

  if (usableSignalingUrls.length > 0 && hasWebRtcRuntime) {
    try {
      webrtc = new WebrtcProvider(roomId, doc, {
        signaling: usableSignalingUrls,
        password: password ?? roomId,
        maxConns: 6,
        peerOpts: { config: { iceServers: iceServers ?? defaultIceServers } },
      });
    } catch (error) {
      void error;
      webrtc = undefined;
    }
  }

  return {
    roomId,
    indexeddb,
    webrtc,
    disconnect() {
      webrtc?.destroy();
      indexeddb.destroy();
    },
  };
}
