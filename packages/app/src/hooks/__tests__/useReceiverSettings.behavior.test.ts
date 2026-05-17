import { createCoopDb } from '@coop/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReceiverSettings } from '../useReceiverSettings';

const dbs: Array<ReturnType<typeof createCoopDb>> = [];

function makeDb() {
  const db = createCoopDb(`receiver-settings-${crypto.randomUUID()}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0, dbs.length)) {
    await db.delete();
  }
});

describe('useReceiverSettings behavior', () => {
  it('creates and refreshes a receiver device identity', async () => {
    const db = makeDb();
    const { result } = renderHook(() => useReceiverSettings(db));

    let firstIdentity!: Awaited<ReturnType<typeof result.current.ensureDeviceIdentity>>;
    let secondIdentity!: Awaited<ReturnType<typeof result.current.ensureDeviceIdentity>>;
    await act(async () => {
      firstIdentity = await result.current.ensureDeviceIdentity();
      secondIdentity = await result.current.ensureDeviceIdentity();
      await result.current.refreshSettings();
    });

    expect(firstIdentity.id).toBe(secondIdentity.id);
    expect(result.current.deviceIdentity?.id).toBe(firstIdentity.id);
    expect(result.current.soundPreferences).toMatchObject({ enabled: true });
  });

  it('requests notification permission and persists the chosen preference', async () => {
    const db = makeDb();
    class MockNotification {
      static permission = 'default';
      static requestPermission = vi.fn(async () => 'granted');
      constructor(
        public title: string,
        public options: NotificationOptions,
      ) {}
    }
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: MockNotification,
    });

    const { result } = renderHook(() => useReceiverSettings(db));

    await act(async () => {
      await result.current.setReceiverNotificationPreference(true);
    });

    expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.receiverNotificationsEnabled).toBe(true);
    expect(result.current.message).toBe('Receiver notifications enabled.');

    await act(async () => {
      await result.current.notifyReceiverEvent('Nest', 'Saved locally', 'capture');
      await result.current.setReceiverNotificationPreference(false);
    });

    expect(result.current.receiverNotificationsEnabled).toBe(false);
    expect(result.current.message).toBe('Receiver notifications disabled.');
  });

  it('handles online state and sound/haptic toggles without receiver install prompts', async () => {
    const db = makeDb();

    const { result } = renderHook(() => useReceiverSettings(db));

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.online).toBe(false);

    await act(async () => {
      result.current.toggleSound();
      result.current.toggleHaptics();
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.online).toBe(true));
    expect(result.current.soundPreferences.enabled).toBe(false);
    expect(result.current.hapticPreferences.enabled).toBe(true);
  });
});
