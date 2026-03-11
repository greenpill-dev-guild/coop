import { describe, expect, it } from 'vitest';
import {
  deriveExtensionIconState,
  extensionIconBadge,
  extensionIconStateLabel,
} from '../icon-state';
import { defaultSoundPreferences, shouldPlaySound, soundPattern } from '../sound';

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
    expect(defaultSoundPreferences.enabled).toBe(false);
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
});
