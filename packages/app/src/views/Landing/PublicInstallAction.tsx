import { detectAppSurface } from '@coop/shared/app';
import QRCode from 'qrcode';
import {
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RECEIVER_APP_ROUTES } from '../../receiver-routes';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type InstallDialogMode = 'desktopQr' | 'mobileSteps';

type InstallGuidance = {
  title: string;
  description: string;
  steps: string[];
  primaryLabel: string;
  action: 'qr' | 'native-install' | 'manual-steps' | 'open-app';
};

type PublicInstallActionProps = {
  children: (props: {
    label: string;
    href: string;
    onClick: MouseEventHandler<HTMLElement>;
    action: InstallGuidance['action'];
  }) => ReactNode;
  mobileOnly?: boolean;
};

const installedStorageKey = 'coop-pwa-installed';

function getAppLaunchUrl() {
  if (typeof window === 'undefined') {
    return RECEIVER_APP_ROUTES.app;
  }

  return new URL(RECEIVER_APP_ROUTES.app, window.location.href).toString();
}

function detectInstallGuidance(
  isMobile: boolean,
  platform: 'ios' | 'android' | 'desktop' | 'unknown',
  userAgent: string,
  installPrompt: BeforeInstallPromptEvent | null,
  wasInstalled: boolean,
): InstallGuidance {
  if (isMobile && wasInstalled) {
    return {
      title: 'Open Coop',
      description: 'Launch the installed receiver from this phone.',
      steps: [],
      primaryLabel: 'Open App',
      action: 'open-app',
    };
  }

  if (!isMobile) {
    return {
      title: 'Install Coop on your phone',
      description: 'Scan this code with your phone, then install from Safari or Chrome.',
      steps: [
        'Scan the QR code with your phone camera.',
        'Open the page in Safari on iPhone or Chrome on Android.',
        'Use Share, then Add to Home Screen on iPhone, or the browser menu, then Install app on Android.',
      ],
      primaryLabel: 'Install App',
      action: 'qr',
    };
  }

  if (installPrompt && platform === 'android') {
    return {
      title: 'Install Coop on this phone',
      description: 'Chrome can install Coop as a home-screen receiver.',
      steps: [],
      primaryLabel: 'Install App',
      action: 'native-install',
    };
  }

  if (platform === 'ios') {
    const isSafari = /^((?!CriOS|FxiOS|EdgiOS).)*Safari/i.test(userAgent);
    return {
      title: 'Install Coop on this iPhone',
      description: isSafari
        ? 'Use Safari to add Coop to your Home Screen.'
        : 'Open this page in Safari, then add Coop to your Home Screen.',
      steps: isSafari
        ? ['Tap Share in Safari.', 'Scroll down and tap Add to Home Screen.']
        : ['Copy or open this page in Safari.', 'Tap Share, then Add to Home Screen.'],
      primaryLabel: 'Install App',
      action: 'manual-steps',
    };
  }

  if (platform === 'android') {
    const isChrome = /Chrome/i.test(userAgent) && !/EdgA|Firefox|SamsungBrowser/i.test(userAgent);
    return {
      title: 'Install Coop on this phone',
      description: isChrome
        ? 'Use Chrome browser controls to install Coop.'
        : 'Open this page in Chrome on Android to install Coop.',
      steps: isChrome
        ? ['Open the Chrome menu.', 'Tap Install app or Add to Home screen.']
        : ['Open this page in Chrome.', 'Use the Chrome menu, then tap Install app.'],
      primaryLabel: 'Install App',
      action: 'manual-steps',
    };
  }

  return {
    title: 'Install Coop on your phone',
    description: 'Open this page in Safari or Chrome, then use the browser install controls.',
    steps: ['Open this page in your phone browser.', 'Use Add to Home Screen or Install app.'],
    primaryLabel: 'Install App',
    action: 'manual-steps',
  };
}

export function PublicInstallAction({ children, mobileOnly = false }: PublicInstallActionProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [wasInstalled, setWasInstalled] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.localStorage.getItem(installedStorageKey) === 'true',
  );
  const [dialogMode, setDialogMode] = useState<InstallDialogMode | null>(null);
  const [qrSvgDataUrl, setQrSvgDataUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const surface = useMemo(() => detectAppSurface(globalThis), []);
  const appLaunchUrl = getAppLaunchUrl();
  const guidance = detectInstallGuidance(
    surface.isMobile,
    surface.platform,
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    installPrompt,
    wasInstalled,
  );

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      window.localStorage.setItem(installedStorageKey, 'true');
      setWasInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (dialogMode !== 'desktopQr') {
      return;
    }

    let cancelled = false;
    void QRCode.toString(appLaunchUrl, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#2c1a12',
        light: '#fffaf3',
      },
    })
      .then((svg) => {
        if (!cancelled) {
          setQrSvgDataUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrSvgDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appLaunchUrl, dialogMode]);

  useEffect(() => {
    if (!dialogMode) {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return undefined;
    }

    if (!dialog.open && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else if (!dialog.open) {
      dialog.setAttribute('open', '');
    }
    closeButtonRef.current?.focus();

    return () => {
      if (dialog.open && typeof dialog.close === 'function') {
        dialog.close();
      } else if (dialog.open) {
        dialog.removeAttribute('open');
      }
    };
  }, [dialogMode]);

  const handleClick = useCallback<MouseEventHandler<HTMLElement>>(
    async (event) => {
      event.preventDefault();

      if (guidance.action === 'open-app') {
        window.location.assign(appLaunchUrl);
        return;
      }

      if (guidance.action === 'native-install' && installPrompt) {
        try {
          await installPrompt.prompt();
          await installPrompt.userChoice.catch(() => undefined);
        } finally {
          setInstallPrompt(null);
        }
        return;
      }

      setDialogMode(guidance.action === 'qr' ? 'desktopQr' : 'mobileSteps');
    },
    [appLaunchUrl, guidance.action, installPrompt],
  );

  if (mobileOnly && !surface.isMobile) {
    return null;
  }

  return (
    <>
      {children({
        label: guidance.primaryLabel,
        href: guidance.action === 'open-app' ? appLaunchUrl : '#install',
        onClick: handleClick,
        action: guidance.action,
      })}

      {dialogMode ? (
        <div className="public-install-overlay" role="presentation">
          <dialog
            ref={dialogRef}
            aria-modal="true"
            className="public-install-dialog"
            aria-labelledby="public-install-title"
            onCancel={(event) => {
              event.preventDefault();
              setDialogMode(null);
            }}
          >
            <button
              ref={closeButtonRef}
              aria-label="Close install instructions"
              className="public-install-close"
              type="button"
              onClick={() => setDialogMode(null)}
            >
              <span aria-hidden="true">x</span>
            </button>
            <div className="public-install-copy">
              <p className="eyebrow">Phone handoff</p>
              <h2 id="public-install-title">{guidance.title}</h2>
              <p className="quiet-note">{guidance.description}</p>
            </div>

            {dialogMode === 'desktopQr' ? (
              <div className="public-install-qr-layout">
                <figure className="public-install-qr">
                  {qrSvgDataUrl ? (
                    <img src={qrSvgDataUrl} alt="QR code for the Coop receiver app" />
                  ) : (
                    <div className="public-install-qr-placeholder" aria-hidden="true" />
                  )}
                  <figcaption>Scan with your phone camera</figcaption>
                </figure>
                <ol className="public-install-steps">
                  {guidance.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <ol className="public-install-steps">
                {guidance.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}

            <a className="button button-secondary public-install-url" href={appLaunchUrl}>
              Open Coop Receiver
            </a>
          </dialog>
        </div>
      ) : null}
    </>
  );
}
