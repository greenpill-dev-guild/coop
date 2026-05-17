export const RECEIVER_APP_ROUTES = {
  app: '/app',
  pair: '/app/pair',
  receiver: '/app/receiver',
  inbox: '/app/inbox',
} as const;

export const RECEIVER_LEGACY_ROUTES = {
  pair: '/pair',
  receiver: '/receiver',
  inbox: '/inbox',
} as const;

export type ReceiverRouteKind = 'pair' | 'receiver' | 'inbox';
export type ReceiverAppRoute =
  | typeof RECEIVER_APP_ROUTES.pair
  | typeof RECEIVER_APP_ROUTES.receiver
  | typeof RECEIVER_APP_ROUTES.inbox;

export function receiverAppRouteFor(kind: ReceiverRouteKind): ReceiverAppRoute {
  return RECEIVER_APP_ROUTES[kind];
}

export function receiverKindFromAppPath(pathname: string): ReceiverRouteKind | null {
  if (pathname === RECEIVER_APP_ROUTES.pair) return 'pair';
  if (pathname === RECEIVER_APP_ROUTES.receiver) return 'receiver';
  if (pathname === RECEIVER_APP_ROUTES.inbox) return 'inbox';
  return null;
}

export function receiverKindFromLegacyPath(pathname: string): ReceiverRouteKind | null {
  if (pathname === RECEIVER_LEGACY_ROUTES.pair) return 'pair';
  if (pathname === RECEIVER_LEGACY_ROUTES.receiver) return 'receiver';
  if (pathname === RECEIVER_LEGACY_ROUTES.inbox) return 'inbox';
  return null;
}
