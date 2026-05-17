import { RECEIVER_APP_ROUTES, RECEIVER_LEGACY_ROUTES } from './receiver-routes';

function extractPairingPayloadFromLocation(location: Location) {
  const hashPayload = new URLSearchParams(location.hash.replace(/^#/, '')).get('payload');
  if (hashPayload?.trim()) {
    return hashPayload.trim();
  }

  const searchPayload = new URLSearchParams(location.search).get('payload');
  return searchPayload?.trim() ? searchPayload.trim() : null;
}

export function bootstrapReceiverPairingHandoff(targetWindow: Window) {
  if (
    targetWindow.location.pathname !== RECEIVER_APP_ROUTES.pair &&
    targetWindow.location.pathname !== RECEIVER_LEGACY_ROUTES.pair
  ) {
    return null;
  }

  const payload = extractPairingPayloadFromLocation(targetWindow.location);
  if (!payload) {
    return null;
  }

  const params = new URLSearchParams(targetWindow.location.search);
  params.delete('payload');
  const nextSearch = params.toString();
  targetWindow.history.replaceState(
    {},
    '',
    `${RECEIVER_APP_ROUTES.pair}${nextSearch ? `?${nextSearch}` : ''}`,
  );
  return payload;
}
