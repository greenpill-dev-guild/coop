import type { UiPreferences } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsStore = new Map<string, unknown>();

const chromeMocks = vi.hoisted(() => ({
  storageSyncGet: vi.fn(async () => ({})),
  storageSyncSet: vi.fn(async () => undefined),
}));

const dbMock = vi.hoisted(() => ({
  isOpen: vi.fn(() => false),
  open: vi.fn(async () => undefined),
  close: vi.fn(),
  delete: vi.fn(async () => undefined),
  settings: {
    get: vi.fn(async (key: string) => {
      if (!settingsStore.has(key)) {
        return undefined;
      }
      return { key, value: settingsStore.get(key) };
    }),
    put: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      settingsStore.set(key, value);
    }),
  },
  coopDocs: {
    toArray: vi.fn(async () => []),
  },
}));

const sharedMocks = vi.hoisted(() => ({
  createCoopDb: vi.fn(() => dbMock),
  createId: vi.fn(() => 'notification-1'),
  detectLocalEnhancementAvailability: vi.fn(() => ({
    status: 'ready',
    model: 'local-helper',
  })),
  getCoopArchiveSecrets: vi.fn(),
  getSoundPreferences: vi.fn(),
  getTrustedNodeArchiveConfig: vi.fn(),
  getUiPreferences: vi.fn(),
  mergeCoopArchiveConfig: vi.fn(
    (config: Record<string, unknown>, secrets: Record<string, unknown>) => ({
      ...config,
      ...secrets,
      merged: true,
    }),
  ),
  setSoundPreferences: vi.fn(async () => undefined),
  setTrustedNodeArchiveConfig: vi.fn(async () => undefined),
  setUiPreferences: vi.fn(async () => undefined),
}));

const configMocks = vi.hoisted(() => ({
  isLocalEnhancementEnabled: vi.fn(() => false),
  parseConfiguredSignalingUrls: vi.fn(() => undefined),
  resolveConfiguredArchiveMode: vi.fn(() => 'mock'),
  resolveConfiguredChain: vi.fn(() => 'sepolia'),
  resolveConfiguredFvmChain: vi.fn(() => 'filecoin'),
  resolveConfiguredFvmOperatorKey: vi.fn(() => undefined),
  resolveConfiguredFvmRegistryAddress: vi.fn(() => undefined),
  resolveConfiguredOnchainMode: vi.fn(() => 'mock'),
  resolveConfiguredPrivacyMode: vi.fn(() => 'off'),
  resolveConfiguredProviderMode: vi.fn(() => 'standard'),
  resolveConfiguredSessionMode: vi.fn(() => 'mock'),
  resolveReceiverAppUrl: vi.fn(() => 'https://receiver.test'),
  resolveTrustedNodeArchiveBootstrapConfig: vi.fn(() => ({
    delegationCid: 'bafy-bootstrap',
  })),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createCoopDb: sharedMocks.createCoopDb,
    createId: sharedMocks.createId,
    detectLocalEnhancementAvailability: sharedMocks.detectLocalEnhancementAvailability,
    getCoopArchiveSecrets: sharedMocks.getCoopArchiveSecrets,
    getSoundPreferences: sharedMocks.getSoundPreferences,
    getTrustedNodeArchiveConfig: sharedMocks.getTrustedNodeArchiveConfig,
    getUiPreferences: sharedMocks.getUiPreferences,
    mergeCoopArchiveConfig: sharedMocks.mergeCoopArchiveConfig,
    setSoundPreferences: sharedMocks.setSoundPreferences,
    setTrustedNodeArchiveConfig: sharedMocks.setTrustedNodeArchiveConfig,
    setUiPreferences: sharedMocks.setUiPreferences,
  };
});

vi.mock('../../runtime/config', () => ({
  isLocalEnhancementEnabled: configMocks.isLocalEnhancementEnabled,
  parseConfiguredSignalingUrls: configMocks.parseConfiguredSignalingUrls,
  resolveConfiguredArchiveMode: configMocks.resolveConfiguredArchiveMode,
  resolveConfiguredChain: configMocks.resolveConfiguredChain,
  resolveConfiguredFvmChain: configMocks.resolveConfiguredFvmChain,
  resolveConfiguredFvmOperatorKey: configMocks.resolveConfiguredFvmOperatorKey,
  resolveConfiguredFvmRegistryAddress: configMocks.resolveConfiguredFvmRegistryAddress,
  resolveConfiguredOnchainMode: configMocks.resolveConfiguredOnchainMode,
  resolveConfiguredPrivacyMode: configMocks.resolveConfiguredPrivacyMode,
  resolveConfiguredProviderMode: configMocks.resolveConfiguredProviderMode,
  resolveConfiguredSessionMode: configMocks.resolveConfiguredSessionMode,
  resolveReceiverAppUrl: configMocks.resolveReceiverAppUrl,
  resolveTrustedNodeArchiveBootstrapConfig: configMocks.resolveTrustedNodeArchiveBootstrapConfig,
}));

const context = await import('../context');

describe('background context helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.clear();

    dbMock.isOpen.mockReturnValue(false);
    dbMock.open.mockResolvedValue(undefined);
    sharedMocks.getSoundPreferences.mockResolvedValue(null);
    sharedMocks.getTrustedNodeArchiveConfig.mockResolvedValue(null);
    sharedMocks.getUiPreferences.mockResolvedValue({
      notificationsEnabled: false,
      localInferenceOptIn: false,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
      agentCadenceMinutes: 64,
      excludedCategories: [],
      customExcludedDomains: [],
      captureOnClose: false,
      uiMode: 'simple',
    });
    sharedMocks.getCoopArchiveSecrets.mockResolvedValue({
      secret: 'coop-secret',
    });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        onLine: true,
      },
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        alarms: {
          clear: vi.fn(async () => undefined),
          create: vi.fn(async () => undefined),
        },
        notifications: {
          create: vi.fn(async () => undefined),
        },
        offscreen: {
          hasDocument: vi.fn(async () => false),
          createDocument: vi.fn(async () => undefined),
        },
        permissions: {
          contains: vi.fn(async () => true),
        },
        runtime: {
          getURL: vi.fn((path: string) => `chrome-extension://${path}`),
          getContexts: vi.fn(async () => []),
        },
        storage: {
          sync: {
            get: chromeMocks.storageSyncGet,
            set: chromeMocks.storageSyncSet,
          },
        },
        tabs: {
          query: vi.fn(async () => []),
        },
      },
    });
  });

  it('opens the extension database when needed', async () => {
    await context.ensureDbReady();

    expect(dbMock.open).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('resets the extension database when Dexie reports a primary key upgrade error', async () => {
    dbMock.open
      .mockRejectedValueOnce(
        Object.assign(new Error('changing primary key is not supported'), {
          name: 'UpgradeError',
        }),
      )
      .mockResolvedValueOnce(undefined);

    await context.ensureDbReady();

    expect(dbMock.close).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(dbMock.open).toHaveBeenCalledTimes(2);
  });

  it('hydrates UI preferences from synced storage and persists the resolved value', async () => {
    chromeMocks.storageSyncGet.mockResolvedValue({
      [context.uiPreferenceStorageKey]: {
        notificationsEnabled: true,
        localInferenceOptIn: true,
      } satisfies Partial<UiPreferences>,
    });

    const preferences = await context.hydrateUiPreferences();

    expect(preferences.notificationsEnabled).toBe(true);
    expect(preferences.localInferenceOptIn).toBe(true);
    expect(preferences.uiMode).toBe('simple');
    expect(sharedMocks.setUiPreferences).toHaveBeenCalledWith(expect.anything(), preferences);
    expect(chromeMocks.storageSyncSet).toHaveBeenCalledWith({
      [context.uiPreferenceStorageKey]: preferences,
    });
  });

  it('keeps an explicit UI preference save from being overwritten by an in-flight hydrate', async () => {
    let releaseHydrateRead: () => void = () => undefined;
    const hydrateReadReady = new Promise<void>((resolve) => {
      releaseHydrateRead = resolve;
    });
    const simplePreferences = {
      notificationsEnabled: false,
      localInferenceOptIn: false,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
      agentCadenceMinutes: 64,
      excludedCategories: [],
      customExcludedDomains: [],
      captureOnClose: false,
      uiMode: 'simple',
    } satisfies UiPreferences;
    const advancedPreferences = {
      ...simplePreferences,
      localInferenceOptIn: true,
      uiMode: 'advanced',
    } satisfies UiPreferences;

    sharedMocks.getUiPreferences.mockImplementationOnce(async () => {
      await hydrateReadReady;
      return simplePreferences;
    });
    chromeMocks.storageSyncGet.mockImplementationOnce(async () => {
      await hydrateReadReady;
      return {
        [context.uiPreferenceStorageKey]: simplePreferences,
      };
    });

    const hydratePromise = context.hydrateUiPreferences();
    const savePromise = context.saveResolvedUiPreferences(advancedPreferences);

    releaseHydrateRead();
    await Promise.all([hydratePromise, savePromise]);

    expect(sharedMocks.setUiPreferences).toHaveBeenLastCalledWith(
      expect.anything(),
      advancedPreferences,
    );
    expect(chromeMocks.storageSyncSet).toHaveBeenLastCalledWith({
      [context.uiPreferenceStorageKey]: advancedPreferences,
    });
  });

  it('deduplicates notifications by event token and stores a sidepanel intent', async () => {
    await context.saveResolvedUiPreferences({
      notificationsEnabled: true,
      localInferenceOptIn: false,
      uiMode: 'advanced',
    } as UiPreferences);

    await context.notifyExtensionEvent({
      eventKind: 'receiver-sync',
      entityId: 'pairing-1',
      state: 'first-sync',
      title: 'Receiver synced',
      message: 'A phone synced.',
      intent: {
        tab: 'nest',
        segment: 'summary',
      },
    });
    await context.notifyExtensionEvent({
      eventKind: 'receiver-sync',
      entityId: 'pairing-1',
      state: 'first-sync',
      title: 'Receiver synced',
      message: 'A phone synced.',
      intent: {
        tab: 'nest',
        segment: 'summary',
      },
    });

    expect(chrome.notifications.create).toHaveBeenCalledTimes(1);
    await expect(context.consumeNotificationIntent('coop-notification-1')).resolves.toEqual({
      tab: 'nest',
      segment: 'summary',
    });
    await expect(context.consumeNotificationIntent('coop-notification-1')).resolves.toBeUndefined();
  });

  it('creates at most one receiver offscreen document when callers race', async () => {
    await Promise.all([
      context.ensureReceiverSyncOffscreenDocument(),
      context.ensureReceiverSyncOffscreenDocument(),
    ]);

    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(1);
    expect(chrome.offscreen.createDocument).toHaveBeenCalledWith({
      url: 'offscreen.html',
      reasons: ['WEB_RTC'],
      justification: 'Keep receiver and coop sync alive while the sidepanel is closed.',
    });
  });

  it('prefers coop-specific archive config when local secrets exist and falls back otherwise', async () => {
    const coop = {
      archiveConfig: {
        gatewayUrl: 'https://coop.archive',
      },
    } as never;

    await expect(context.resolveArchiveConfigForCoop('coop-1', coop)).resolves.toEqual({
      gatewayUrl: 'https://coop.archive',
      secret: 'coop-secret',
      merged: true,
    });

    sharedMocks.getCoopArchiveSecrets.mockResolvedValue(undefined);
    sharedMocks.getTrustedNodeArchiveConfig.mockResolvedValue({
      delegationCid: 'bafy-global',
    });

    await expect(context.resolveArchiveConfigForCoop('coop-1', coop)).resolves.toEqual(null);
    await expect(context.resolveArchiveConfigForCoop('coop-2', {} as never)).resolves.toEqual({
      delegationCid: 'bafy-global',
    });
  });

  it('seeds default local settings and trusted archive bootstrap state on first run', async () => {
    await context.ensureDefaults();

    expect(sharedMocks.setSoundPreferences).toHaveBeenCalledTimes(1);
    expect(sharedMocks.setTrustedNodeArchiveConfig).toHaveBeenCalledWith(expect.anything(), {
      delegationCid: 'bafy-bootstrap',
    });
    expect(settingsStore.get(context.stateKeys.captureMode)).toBe('manual');
    expect(settingsStore.get(context.stateKeys.runtimeHealth)).toEqual(
      context.defaultRuntimeHealth,
    );
  });

  it('syncs cadence and capture alarms with the expected periods', async () => {
    await context.syncAgentCadenceAlarm(16);
    await context.syncCaptureAlarm('30-min');

    expect(chrome.alarms.clear).toHaveBeenCalledWith(context.alarmNames.agentCadence);
    expect(chrome.alarms.create).toHaveBeenCalledWith(context.alarmNames.agentCadence, {
      periodInMinutes: 16,
    });
    expect(chrome.alarms.clear).toHaveBeenCalledWith(context.alarmNames.capture);
    expect(chrome.alarms.create).toHaveBeenCalledWith(context.alarmNames.capture, {
      periodInMinutes: 30,
    });
    expect(context.getCapturePeriodMinutes('manual')).toBeNull();
  });

  it('checks runtime health against the configured receiver origin permissions', async () => {
    await context.getRuntimeHealth();

    expect(chrome.permissions.contains).toHaveBeenCalledWith({
      permissions: [
        'storage',
        'alarms',
        'tabs',
        'scripting',
        'sidePanel',
        'activeTab',
        'contextMenus',
        'notifications',
      ],
      origins: ['https://receiver.test/*'],
    });
  });
});
