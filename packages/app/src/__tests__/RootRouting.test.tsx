import {
  createReceiverPairingPayload,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  upsertReceiverPairing,
} from '@coop/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { receiverDb, resetReceiverDb, resolveRootDestination, resolveRoute } from '../app';
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

  it('resolves known routes, including the new root and landing split', () => {
    expect(resolveRoute('/')).toEqual({ kind: 'root' });
    expect(resolveRoute('/landing')).toEqual({ kind: 'landing' });
    expect(resolveRoute('/pair')).toEqual({ kind: 'pair' });
    expect(resolveRoute('/receiver')).toEqual({ kind: 'receiver' });
    expect(resolveRoute('/inbox')).toEqual({ kind: 'inbox' });
    expect(resolveRoute('/board/coop-1')).toEqual({ kind: 'board', coopId: 'coop-1' });
  });

  it('resolves root destinations from platform surface and pairing state', () => {
    expect(resolveRootDestination({ isMobile: false, isStandalone: false }, false)).toBe(
      '/landing',
    );
    expect(resolveRootDestination({ isMobile: true, isStandalone: false }, false)).toBe('/pair');
    expect(resolveRootDestination({ isMobile: true, isStandalone: false }, true)).toBe('/receiver');
    expect(resolveRootDestination({ isMobile: false, isStandalone: true }, false)).toBe('/pair');
  });

  it('redirects desktop root visits to landing', async () => {
    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/landing');
    });
    expect(
      await screen.findByRole('heading', {
        name: /no more chickens loose/i,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop | Turn knowledge into opportunity');
    });
  });

  it('redirects mobile root visits without a pairing to mate', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      innerWidth: 390,
      maxTouchPoints: 5,
    });

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/pair');
    });
    expect(await screen.findByRole('heading', { name: /^Mate$/i })).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop Mate');
    });
  });

  it('redirects mobile root visits with an active pairing to hatch', async () => {
    stubSurface({
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
      innerWidth: 412,
      maxTouchPoints: 5,
    });
    await seedActivePairing();

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/receiver');
    });
    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Coop Hatch');
    });
  });

  it('treats standalone launches like app entry and sends unpaired devices to mate', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      standalone: true,
      innerWidth: 1024,
    });

    await renderRootApp();

    await waitFor(() => {
      expect(window.location.pathname).toBe('/pair');
    });
    expect(await screen.findByRole('heading', { name: /^Mate$/i })).toBeVisible();
  });

  it('preserves explicit routes instead of rerouting them through root heuristics', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    window.history.pushState({}, '', '/inbox');

    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Roost$/i })).toBeVisible();
    expect(window.location.pathname).toBe('/inbox');
  });

  it('keeps the receiver brand mark inside the app shell and shows mobile install guidance', async () => {
    stubSurface({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      innerWidth: 390,
      maxTouchPoints: 5,
    });
    window.history.pushState({}, '', '/receiver');

    await renderRootApp();

    expect(await screen.findByRole('heading', { name: /^Hatch$/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /keep coop one tap away/i })).toBeVisible();

    fireEvent.click(screen.getByRole('link', { name: 'Coop' }));

    expect(window.location.pathname).toBe('/receiver');
  });
});
