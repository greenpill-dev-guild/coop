import { type CoopBoardSnapshot, decodeCoopBoardSnapshot } from '@coop/shared';

function resolveBoardCoopId(pathname: string) {
  const match = pathname.match(/^\/board\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractBoardSnapshotPayload(location: Location) {
  const hashPayload = new URLSearchParams(location.hash.replace(/^#/, '')).get('snapshot');
  if (hashPayload?.trim()) {
    return hashPayload.trim();
  }

  const searchPayload = new URLSearchParams(location.search).get('snapshot');
  return searchPayload?.trim() ? searchPayload.trim() : null;
}

export function bootstrapCoopBoardHandoff(targetWindow: Window): CoopBoardSnapshot | null {
  const coopId = resolveBoardCoopId(targetWindow.location.pathname);
  if (!coopId) {
    return null;
  }

  const payload = extractBoardSnapshotPayload(targetWindow.location);
  if (!payload) {
    return null;
  }

  const params = new URLSearchParams(targetWindow.location.search);
  params.delete('snapshot');
  const nextSearch = params.toString();
  targetWindow.history.replaceState(
    {},
    '',
    `/board/${encodeURIComponent(coopId)}${nextSearch ? `?${nextSearch}` : ''}`,
  );

  try {
    const snapshot = decodeCoopBoardSnapshot(payload);
    return snapshot.coopId === coopId ? snapshot : null;
  } catch {
    return null;
  }
}
