import {
  buildReceiverPairingDeepLink,
  createReceiverPairingPayload,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  upsertReceiverPairing,
} from '@coop/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverDb, resetReceiverDb, resolveRootDestination, resolveRoute } from '../app';
import { bootstrapReceiverPairingHandoff } from '../pairing-handoff';
import { bootstrapReceiverShareHandoff } from '../share-handoff';
import { renderRootApp } from './root-app-test-utils';

function stubSurface({
  userAgent,
  standalone = false,
  coarsePointer = false,
  innerWidth = 1280,
  maxTouchPoints = 0,
}: {
  userAgent: string;
  standalone?: boolean;
  coarsePointer?: boolean;
  innerWidth?: number;
  maxTouchPoints?: number;
}) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: innerWidth,
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value: standalone,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches:
        (query === '(display-mode: standalone)' && standalone) ||
        (query === '(pointer: coarse)' && coarsePointer),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function seedActivePairing() {
  const payload = createReceiverPairingPayload({
    coopId: 'root-coop',
    coopDisplayName: 'Root Coop',
    memberId: 'mina',
    memberDisplayName: 'Mina',
    signalingUrls: ['ws://127.0.0.1:4444'],
  });
  const pairing = toReceiverPairingRecord(payload, '2026-03-17T12:00:00.000Z');
  await upsertReceiverPairing(receiverDb, pairing);
  await setActiveReceiverPairing(receiverDb, pairing.pairingId);
}

describe('root routing bootstrap', () => {
  beforeEach(async () => {
    await resetReceiverDb();
    stubSurface({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    });
    window.history.pushState({}, '', '/');
  });

  afterEach(async () => {
    await resetReceiverDb();
    window.history.pushState({}, '', '/');
  });

  it('resolves known routes, including app-prefixed and legacy receiver routes', () => {
    expect(resolveRoute('/')).toEqual({ kind: 'root' });
    expect(resolveRoute('/landing')).toEqual({ kind: 'landing' });
    expect(resolveRoute('/app')).toEqual({ kind: 'appRoot' });
    expect(resolveRoute('/app/pair')).toEqual({ kind: 'pair', presentation: 'app' });
    expect(resolveRoute('/app/receiver')).toEqual({ kind: 'receiver', presentation: 'app' });
    expect(resolveRoute('/app/inbox')).toEqual({ kind: 'inbox', presentation: 'app' });
    expect(resolveRoute('/pair')).toEqual({ kind: 'pair', presentation: 'legacy' });
    expect(resolveRoute('/receiver')).toEqual({ kind: 'receiver', presentation: 'legacy' });
    expect(resolveRoute('/inbox')).toEqual({ kind: 'inbox', presentation: 'legacy' });
    expect(resolveRoute('/board/coop-1')).toEqual({ kind: 'board', coopId: 'coop-1' });
  });

  it('resolves root destinations from platform surface and pairing state', () => {
    expect(resolveRootDestination({ isMobile: false, isStandalone: false }, false)).toBe('/');
    expect(resolveRootDestination({ isMobile: true, isStandalone: false }, false)).toBe('/');
    expect(resolveRootDestination({ isMobile: true, isStandalone: false }, true)).toBe('/');
    expect(resolveRootDestination({ isMobile: false, isStandalone: true }, false)).toBe(
      '/app/pair',
    );
    expect(resolveRootDestination({ isMobile: true, isStandalone: true }, true)).toBe(
      '/app/receiver',
    );
  });

  it('renders the public landing at browser root', async () => {
    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(
      await screen.findByRole('heading', {
        name: /chicken or egg\? neither — you need a coop first\./i,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop | Turn knowledge into opportunity');
    });
  });

  it('redirects mobile browser root visits without a pairing to landing', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      innerWidth: 390,
      maxTouchPoints: 5,
    });

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(
      await screen.findByRole('heading', {
        name: /chicken or egg\? neither — you need a coop first\./i,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop | Turn knowledge into opportunity');
    });
  });

  it('redirects mobile browser root visits with an active pairing to landing', async () => {
    stubSurface({
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
      innerWidth: 412,
      maxTouchPoints: 5,
    });
    await seedActivePairing();

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(
      await screen.findByRole('heading', {
        name: /chicken or egg\? neither — you need a coop first\./i,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop | Turn knowledge into opportunity');
    });
  });

  it('treats standalone root launches like app entry and sends unpaired devices to mate', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      standalone: true,
      innerWidth: 1024,
    });

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/pair');
    });
    expect(await screen.findByRole('heading', { name: /^Mate$/i })).toBeVisible();
  });

  it('treats standalone root launches like app entry and sends paired devices to hatch', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      standalone: true,
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    await seedActivePairing();

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/receiver');
    });
    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
  });

  it('redirects direct app routes back to the public website in normal browser mode', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    });
    window.history.pushState({}, '', '/app/receiver');

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(screen.queryByRole('heading', { name: /^Hatch$/i })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: /chicken or egg\? neither — you need a coop first\./i,
      }),
    ).toBeVisible();
  });

  it('does not review pairing handoffs from normal browser visits', async () => {
    const payload = createReceiverPairingPayload({
      coopId: 'browser-coop',
      coopDisplayName: 'Browser Coop',
      memberId: 'browser-member',
      memberDisplayName: 'Bea',
    });
    const deepLink = buildReceiverPairingDeepLink('http://localhost', payload);
    const parsedDeepLink = new URL(deepLink);
    window.history.pushState({}, '', `${parsedDeepLink.pathname}${parsedDeepLink.hash}`);

    const handoff = bootstrapReceiverPairingHandoff(window);

    expect(window.location.pathname).toBe('/app/pair');
    expect(handoff).toBeTruthy();

    await renderRootApp({ initialPairingInput: handoff });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(screen.queryByRole('button', { name: /join this coop/i })).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(await receiverDb.receiverPairings.toArray()).toHaveLength(0);
    });
  });

  it('does not ingest share handoffs from normal browser visits', async () => {
    window.history.pushState(
      {},
      '',
      '/receiver?title=Shared%20Grant&text=Follow%20up&url=https%3A%2F%2Fexample.com%2Fgrant',
    );

    const handoff = bootstrapReceiverShareHandoff(window);

    expect(window.location.pathname).toBe('/app/receiver');
    expect(handoff?.title).toBe('Shared Grant');

    await renderRootApp({ initialShareInput: handoff });

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(screen.queryByText('Shared Grant')).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(await receiverDb.receiverCaptures.toArray()).toHaveLength(0);
    });
  });

  it('renders explicit app routes in standalone mode', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      standalone: true,
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    window.history.pushState({}, '', '/app/inbox');

    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Roost$/i })).toBeVisible();
    expect(window.location.pathname).toBe('/app/inbox');
  });

  it('forwards legacy receiver routes only in standalone mode', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      standalone: true,
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    window.history.pushState({}, '', '/receiver');

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/app/receiver');
    });
    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
  });

  it('redirects legacy receiver routes to public root in normal browser mode', async () => {
    window.history.pushState({}, '', '/receiver');

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    expect(screen.queryByRole('heading', { name: /^Hatch$/i })).not.toBeInTheDocument();
  });

  it('keeps the receiver brand mark inside the Hatch shell without install overflow', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      standalone: true,
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    window.history.pushState({}, '', '/app/receiver');

    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: /keep coop one tap away/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/about coop/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Coop' }));

    expect(window.location.pathname).toBe('/app/receiver');
  });
});
