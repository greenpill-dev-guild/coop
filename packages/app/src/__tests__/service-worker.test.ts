import { describe, expect, it, vi } from 'vitest';
import { registerReceiverServiceWorker } from '../service-worker';

describe('receiver service worker registration', () => {
  it('cleans stale registrations instead of registering during development', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      register: vi.fn().mockResolvedValue(undefined),
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
    };

    registerReceiverServiceWorker({
      isProduction: false,
      serviceWorker,
      win: { addEventListener: vi.fn() },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(serviceWorker.getRegistrations).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('registers the receiver service worker on load in production', async () => {
    const serviceWorker = {
      register: vi.fn().mockResolvedValue(undefined),
    };
    const addEventListener = vi.fn((event: string, listener: () => void) => {
      if (event === 'load') {
        listener();
      }
    });

    registerReceiverServiceWorker({
      isProduction: true,
      serviceWorker,
      win: { addEventListener },
    });

    await Promise.resolve();

    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function));
    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/app' });
  });
});
