import {
  type HapticPreferences,
  type ReceiverDeviceIdentity,
  type SoundPreferences,
  createReceiverDeviceIdentity,
  defaultHapticPreferences,
  defaultSoundPreferences,
  getHapticPreferences,
  getReceiverDeviceIdentity,
  getSoundPreferences,
  nowIso,
  setHapticPreferences,
  setReceiverDeviceIdentity,
  setSoundPreferences,
  triggerHaptic,
} from '@coop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { receiverDb as ReceiverDbType } from '../app';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const receiverNotificationSettingKey = 'receiver-notifications-enabled';

export type ReceiverSettingsState = {
  online: boolean;
  message: string;
  setMessage: (message: string) => void;
  deviceIdentity: ReceiverDeviceIdentity | null;
  soundPreferences: SoundPreferences;
  hapticPreferences: HapticPreferences;
  installPrompt: BeforeInstallPromptEvent | null;
  receiverNotificationsEnabled: boolean;
  notificationPermission: string;
  isMountedRef: React.RefObject<boolean>;
  ensureDeviceIdentity: () => Promise<ReceiverDeviceIdentity>;
  notifyReceiverEvent: (title: string, body: string, tag: string) => Promise<void>;
  setReceiverNotificationPreference: (enabled: boolean) => Promise<void>;
  installApp: () => Promise<void>;
  toggleSound: () => void;
  toggleHaptics: () => void;
  refreshSettings: () => Promise<{
    soundPrefs: SoundPreferences;
    hapticPrefs: HapticPreferences;
    notificationsEnabled: boolean;
    device: ReceiverDeviceIdentity | null;
  }>;
};

export function useReceiverSettings(db: typeof ReceiverDbType): ReceiverSettingsState {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [message, setMessage] = useState('');
  const [deviceIdentity, setDeviceIdentity] = useState<ReceiverDeviceIdentity | null>(null);
  const [soundPreferences, setSoundPreferencesState] =
    useState<SoundPreferences>(defaultSoundPreferences);
  const [hapticPreferences, setHapticPreferencesState] =
    useState<HapticPreferences>(defaultHapticPreferences);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [receiverNotificationsEnabled, setReceiverNotificationsEnabledState] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const isMountedRef = useRef(false);

  const ensureDeviceIdentity = useCallback(async () => {
    const existing = (await getReceiverDeviceIdentity(db)) ?? deviceIdentity;
    if (existing) {
      const touched = {
        ...existing,
        lastSeenAt: nowIso(),
      } satisfies ReceiverDeviceIdentity;
      await setReceiverDeviceIdentity(db, touched);
      if (isMountedRef.current) {
        setDeviceIdentity(touched);
      }
      return touched;
    }

    const created = createReceiverDeviceIdentity(
      /iPhone|Android/i.test(navigator.userAgent) ? 'Pocket Receiver' : 'Receiver Browser',
    );
    await setReceiverDeviceIdentity(db, created);
    if (isMountedRef.current) {
      setDeviceIdentity(created);
    }
    return created;
  }, [db, deviceIdentity]);

  const notifyReceiverEvent = useCallback(
    async (title: string, body: string, tag: string) => {
      if (
        !receiverNotificationsEnabled ||
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted'
      ) {
        return;
      }

      try {
        new Notification(title, { body, tag });
      } catch {
        // Notifications are optional.
      }
    },
    [receiverNotificationsEnabled],
  );

  const setReceiverNotificationPreference = useCallback(
    async (enabled: boolean) => {
      if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission !== 'granted') {
          setMessage('Notifications stay off until the browser grants permission.');
          await db.settings.put({ key: receiverNotificationSettingKey, value: false });
          setReceiverNotificationsEnabledState(false);
          return;
        }
      }

      await db.settings.put({ key: receiverNotificationSettingKey, value: enabled });
      setReceiverNotificationsEnabledState(enabled);
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission);
      }
      setMessage(enabled ? 'Receiver notifications enabled.' : 'Receiver notifications disabled.');
    },
    [db],
  );

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    if (isMountedRef.current) {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  const toggleSound = useCallback(() => {
    const nextSound = { ...soundPreferences, enabled: !soundPreferences.enabled };
    setSoundPreferencesState(nextSound);
    void setSoundPreferences(db, nextSound);
  }, [db, soundPreferences]);

  const toggleHaptics = useCallback(() => {
    const nextHaptic = { ...hapticPreferences, enabled: !hapticPreferences.enabled };
    setHapticPreferencesState(nextHaptic);
    void setHapticPreferences(db, nextHaptic);
    if (nextHaptic.enabled) {
      triggerHaptic('button-press', nextHaptic);
    }
  }, [db, hapticPreferences]);

  const refreshSettings = useCallback(async () => {
    const [nextDevice, nextNotificationsEnabled, nextSoundPrefs, nextHapticPrefs] =
      await Promise.all([
        getReceiverDeviceIdentity(db),
        (async () => {
          const record = await db.settings.get(receiverNotificationSettingKey);
          return record?.value === true;
        })(),
        getSoundPreferences(db),
        getHapticPreferences(db),
      ]);

    if (isMountedRef.current) {
      setDeviceIdentity(nextDevice);
      setReceiverNotificationsEnabledState(nextNotificationsEnabled);
      setSoundPreferencesState(nextSoundPrefs ?? defaultSoundPreferences);
      setHapticPreferencesState(nextHapticPrefs ?? defaultHapticPreferences);
      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission);
      }
    }

    return {
      soundPrefs: nextSoundPrefs ?? defaultSoundPreferences,
      hapticPrefs: nextHapticPrefs ?? defaultHapticPreferences,
      notificationsEnabled: nextNotificationsEnabled,
      device: nextDevice,
    };
  }, [db]);

  // Online/offline + install prompt + mount tracking
  useEffect(() => {
    isMountedRef.current = true;

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Reduced motion media query
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = (matches: boolean) => {
      setSoundPreferencesState((prev) => ({
        ...prev,
        reducedMotion: matches,
        reducedSound: matches,
      }));
      setHapticPreferencesState((prev) => ({ ...prev, reducedMotion: matches }));
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return {
    online,
    message,
    setMessage,
    deviceIdentity,
    soundPreferences,
    hapticPreferences,
    installPrompt,
    receiverNotificationsEnabled,
    notificationPermission,
    isMountedRef,
    ensureDeviceIdentity,
    notifyReceiverEvent,
    setReceiverNotificationPreference,
    installApp,
    toggleSound,
    toggleHaptics,
    refreshSettings,
  };
}
