import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type BackgroundNotification,
  notifyDashboardUpdated,
  sendRuntimeMessage,
} from '../messages';

describe('runtime message bridge', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('forwards runtime requests through the extension bridge', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: 3,
    });
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage,
        },
      },
    });

    const message = { type: 'manual-capture' } as const;
    await expect(sendRuntimeMessage<number>(message)).resolves.toEqual({
      ok: true,
      data: 3,
    });
    expect(sendMessage).toHaveBeenCalledWith(message);
  });
});

describe('notifyDashboardUpdated', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('sends a DASHBOARD_UPDATED message via chrome.runtime.sendMessage', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage,
        },
      },
    });

    await notifyDashboardUpdated();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'DASHBOARD_UPDATED' });
  });

  it('silently catches errors when no listener exists', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('Receiving end does not exist'));
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage,
        },
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not throw and should not warn for expected error.
    await expect(notifyDashboardUpdated()).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('warns on unexpected errors instead of swallowing them', async () => {
    const unexpectedError = new Error('Something went wrong');
    const sendMessage = vi.fn().mockRejectedValue(unexpectedError);
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage,
        },
      },
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not throw but should log a warning.
    await expect(notifyDashboardUpdated()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[notifyDashboardUpdated] unexpected error:',
      unexpectedError,
    );

    warnSpy.mockRestore();
  });

  it('produces a value assignable to BackgroundNotification', () => {
    const msg: BackgroundNotification = { type: 'DASHBOARD_UPDATED' };
    expect(msg.type).toBe('DASHBOARD_UPDATED');
  });
});
