import { describe, expect, it } from 'vitest';
import { detectBrowserUxCapabilities } from '../capabilities';
import {
  deriveExtensionIconState,
  extensionIconBadge,
  extensionIconStateLabel,
} from '../icon-state';
import { defaultSoundPreferences, shouldPlaySound, soundPattern } from '../sound';
import { detectAppSurface } from '../surface';

describe('shared app helpers', () => {
  it('derives icon states, labels, and badges for all runtime cases', () => {
    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: false,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('idle');
    expect(extensionIconStateLabel('idle')).toBe('Idle');
    expect(extensionIconBadge('idle')).toEqual({
      text: 'IDLE',
      color: '#4f2e1f',
    });

    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: true,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('watching');
    expect(extensionIconStateLabel('watching')).toBe('Watching');
    expect(extensionIconBadge('watching')).toEqual({
      text: 'SCAN',
      color: '#5a7d10',
    });

    expect(
      deriveExtensionIconState({
        pendingDrafts: 2,
        watching: true,
        offline: false,
        missingPermission: false,
        syncError: false,
      }),
    ).toBe('review-needed');
    expect(extensionIconStateLabel('review-needed')).toBe('Review Needed');
    expect(extensionIconBadge('review-needed')).toEqual({
      text: 'ROST',
      color: '#fd8a01',
    });

    expect(
      deriveExtensionIconState({
        pendingDrafts: 0,
        watching: false,
        offline: true,
        missingPermission: false,
        syncError: true,
      }),
    ).toBe('error-offline');
    expect(extensionIconStateLabel('error-offline')).toBe('Error / Offline');
    expect(extensionIconBadge('error-offline')).toEqual({
      text: 'ERR',
      color: '#a63b20',
    });
  });

  it('keeps sound muted unless an explicit supported success event is allowed', () => {
    expect(defaultSoundPreferences.enabled).toBe(true);
    expect(soundPattern('coop-created')).toHaveLength(3);
    expect(soundPattern('artifact-published')).toHaveLength(2);
    expect(soundPattern('sound-test')).toHaveLength(3);

    expect(
      shouldPlaySound('coop-created', {
        ...defaultSoundPreferences,
        enabled: true,
      }),
    ).toBe(true);
    expect(
      shouldPlaySound(
        'artifact-published',
        {
          enabled: true,
          reducedMotion: false,
          reducedSound: true,
        },
        true,
      ),
    ).toBe(false);
    expect(
      shouldPlaySound(
        'sound-test',
        {
          enabled: true,
          reducedMotion: false,
          reducedSound: false,
        },
        false,
      ),
    ).toBe(false);
  });

  it('detects optional browser UX capabilities conservatively', () => {
    const capabilities = detectBrowserUxCapabilities({
      Notification: class NotificationMock {} as unknown as typeof Notification,
      navigator: {
        share() {
          return Promise.resolve();
        },
        setAppBadge() {
          return Promise.resolve();
        },
      } as unknown as Navigator,
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async () => undefined,
          close: async () => undefined,
        }),
      }),
      BarcodeDetector: class BarcodeDetectorMock {},
    } as unknown as typeof globalThis);

    expect(capabilities).toMatchObject({
      canNotify: true,
      canScanQr: true,
      canSaveFile: true,
      canSetBadge: true,
      canShare: true,
    });
  });

  it('detects mobile app surfaces from standalone mode and platform context', () => {
    const iosSurface = detectAppSurface({
      innerWidth: 390,
      matchMedia(query: string) {
        return {
          matches: query === '(display-mode: standalone)',
        } as MediaQueryList;
      },
      navigator: {
        standalone: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
      } as unknown as Navigator,
    } as unknown as typeof globalThis);

    expect(iosSurface).toEqual({
      isMobile: true,
      isStandalone: true,
      platform: 'ios',
    });
  });

  it('falls back to coarse-pointer mobile detection when the user agent is ambiguous', () => {
    const fallbackSurface = detectAppSurface({
      innerWidth: 768,
      matchMedia(query: string) {
        return {
          matches: query === '(pointer: coarse)',
        } as MediaQueryList;
      },
      navigator: {
        userAgent: 'Mozilla/5.0',
        maxTouchPoints: 1,
      } as unknown as Navigator,
    } as unknown as typeof globalThis);

    expect(fallbackSurface).toEqual({
      isMobile: true,
      isStandalone: false,
      platform: 'unknown',
    });
  });

  it('keeps standard desktop browsers out of the mobile bootstrap path', () => {
    const desktopSurface = detectAppSurface({
      innerWidth: 1280,
      matchMedia() {
        return {
          matches: false,
        } as MediaQueryList;
      },
      navigator: {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        maxTouchPoints: 0,
      } as unknown as Navigator,
    } as unknown as typeof globalThis);

    expect(desktopSurface).toEqual({
      isMobile: false,
      isStandalone: false,
      platform: 'desktop',
    });
  });
});
