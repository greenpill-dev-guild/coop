type ServiceWorkerContainerLike = {
  register: (scriptURL: string, options?: RegistrationOptions) => Promise<unknown>;
  getRegistrations?: () => Promise<ReadonlyArray<{ unregister: () => Promise<boolean> | boolean }>>;
};

type ServiceWorkerRegistrationOptions = {
  isProduction?: boolean;
  serviceWorker?: ServiceWorkerContainerLike | null;
  win?: Pick<Window, 'addEventListener'>;
};

export function registerReceiverServiceWorker({
  isProduction = import.meta.env.PROD,
  serviceWorker = typeof navigator === 'undefined' ? null : navigator.serviceWorker,
  win = window,
}: ServiceWorkerRegistrationOptions = {}) {
  if (!serviceWorker) {
    return;
  }

  if (!isProduction) {
    void serviceWorker
      .getRegistrations?.()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch((error) => {
        console.warn('[coop] Service worker cleanup failed:', error);
      });
    return;
  }

  win.addEventListener('load', () => {
    void serviceWorker.register('/sw.js', { scope: '/app' }).catch((error) => {
      console.warn('[coop] Service worker registration failed:', error);
    });
  });
}
