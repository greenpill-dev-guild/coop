import type { ArtifactAttachment, BlobOrigin } from '../../contracts/schema';
import { nowIso } from '../../utils';
import type { CoopDexie } from '../storage/db';
import { getCoopBlob, saveCoopBlob, touchCoopBlobAccess } from './store';
import type { BlobSyncChannel } from './sync';

const DEFAULT_GATEWAY_BASE_URL = 'https://storacha.link';
const GATEWAY_TIMEOUT_MS = 30_000;

/** Resolve a blob using three-tier strategy: local -> peer -> gateway */
export async function resolveBlob(input: {
  db: CoopDexie;
  blobId: string;
  attachment: ArtifactAttachment;
  coopId: string;
  blobSync?: BlobSyncChannel;
  gatewayBaseUrl?: string;
}): Promise<{ bytes: Uint8Array; source: BlobOrigin } | null> {
  const { db, blobId, attachment, coopId, blobSync } = input;

  // Tier 1: Local Dexie
  const local = await getCoopBlob(db, blobId);
  if (local) {
    await touchCoopBlobAccess(db, blobId);
    return { bytes: local.bytes, source: local.record.origin };
  }

  // Tier 2: Peer fetch via WebRTC
  if (blobSync) {
    const peerBytes = await blobSync.requestBlob(blobId);
    if (peerBytes) {
      // Cache locally for future access
      const now = nowIso();
      await saveCoopBlob(
        db,
        {
          blobId,
          sourceEntityId: blobId,
          coopId,
          mimeType: attachment.mimeType,
          byteSize: peerBytes.length,
          kind: attachment.kind,
          origin: 'peer',
          createdAt: now,
          accessedAt: now,
        },
        peerBytes,
      );
      return { bytes: peerBytes, source: 'peer' };
    }
  }

  // Tier 3: IPFS gateway (if archived)
  if (attachment.archiveCid) {
    const gatewayBytes = await fetchBlobFromGateway(attachment.archiveCid, input.gatewayBaseUrl);
    if (gatewayBytes) {
      const now = nowIso();
      await saveCoopBlob(
        db,
        {
          blobId,
          sourceEntityId: blobId,
          coopId,
          mimeType: attachment.mimeType,
          byteSize: gatewayBytes.length,
          kind: attachment.kind,
          origin: 'gateway',
          createdAt: now,
          accessedAt: now,
        },
        gatewayBytes,
      );
      return { bytes: gatewayBytes, source: 'gateway' };
    }
  }

  return null;
}

/** Validate CID format to prevent path traversal / SSRF */
const CID_PATTERN = /^[a-zA-Z0-9+/=_-]+$/;

/** Fetch blob bytes from an IPFS gateway by CID */
export async function fetchBlobFromGateway(
  cid: string,
  gatewayBaseUrl?: string,
): Promise<Uint8Array | null> {
  if (!cid || !CID_PATTERN.test(cid)) return null;

  const baseUrl = gatewayBaseUrl ?? DEFAULT_GATEWAY_BASE_URL;
  const url = `${baseUrl}/ipfs/${cid}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}
