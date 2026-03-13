function extractPairingPayloadFromLocation(location: Location) {
  const hashPayload = new URLSearchParams(location.hash.replace(/^#/, '')).get('payload');
  if (hashPayload?.trim()) {
    return hashPayload.trim();
  }

  const searchPayload = new URLSearchParams(location.search).get('payload');
  return searchPayload?.trim() ? searchPayload.trim() : null;
}

export function bootstrapReceiverPairingHandoff(targetWindow: Window) {
  if (targetWindow.location.pathname !== '/pair') {
    return null;
  }

  const payload = extractPairingPayloadFromLocation(targetWindow.location);
  if (!payload) {
    return null;
  }

  const params = new URLSearchParams(targetWindow.location.search);
  params.delete('payload');
  const nextSearch = params.toString();
  targetWindow.history.replaceState({}, '', `/pair${nextSearch ? `?${nextSearch}` : ''}`);
  return payload;
}
