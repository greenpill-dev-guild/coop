import { RECEIVER_APP_ROUTES, RECEIVER_LEGACY_ROUTES } from './receiver-routes';
import { isSafeExternalUrl } from './url-safety';

export type ReceiverShareHandoff = {
  title?: string;
  note?: string;
  sourceUrl?: string;
};

export function bootstrapReceiverShareHandoff(targetWindow: Window): ReceiverShareHandoff | null {
  if (
    targetWindow.location.pathname !== RECEIVER_APP_ROUTES.receiver &&
    targetWindow.location.pathname !== RECEIVER_LEGACY_ROUTES.receiver
  ) {
    return null;
  }

  const params = new URLSearchParams(targetWindow.location.search);
  const title = params.get('title')?.trim() || undefined;
  const note = params.get('text')?.trim() || undefined;
  const rawUrl = params.get('url')?.trim() || undefined;
  const sourceUrl = rawUrl && isSafeExternalUrl(rawUrl) ? rawUrl : undefined;

  if (!title && !note && !sourceUrl) {
    return null;
  }

  params.delete('title');
  params.delete('text');
  params.delete('url');
  const nextSearch = params.toString();
  targetWindow.history.replaceState(
    {},
    '',
    `${RECEIVER_APP_ROUTES.receiver}${nextSearch ? `?${nextSearch}` : ''}`,
  );

  return {
    title,
    note,
    sourceUrl,
  };
}
