import type { ReceiverPairingPayload } from '@coop/shared';
import { type RefObject, useEffect, useRef } from 'react';

export type PairingPanelProps = {
  pairingInput: string;
  pendingPairing: ReceiverPairingPayload | null;
  pairingError: string;
  qrScanError: string;
  isQrScannerOpen: boolean;
  qrVideoRef: RefObject<HTMLVideoElement | null>;
  onPairingInputChange: (value: string) => void;
  onReviewPairing: (value: string) => void;
  onConfirmPairing: () => void;
  onCancelPairing: () => void;
  onStartQrScanner: () => void;
  onStopQrScanner: () => void;
  onNavigateToReceiver: () => void;
};

export function PairingPanel({
  pairingInput,
  pendingPairing,
  pairingError,
  qrScanError,
  isQrScannerOpen,
  qrVideoRef,
  onPairingInputChange,
  onReviewPairing,
  onConfirmPairing,
  onCancelPairing,
  onStartQrScanner,
  onStopQrScanner,
  onNavigateToReceiver,
}: PairingPanelProps) {
  const stopButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close scanner on Escape key (document-level so it works regardless of focus)
  useEffect(() => {
    if (!isQrScannerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onStopQrScanner();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isQrScannerOpen, onStopQrScanner]);

  // Auto-focus the stop button when scanner opens
  useEffect(() => {
    if (isQrScannerOpen) {
      stopButtonRef.current?.focus();
    }
  }, [isQrScannerOpen]);

  return (
    <section className="receiver-grid">
      <article className="nest-card receiver-card">
        <p className="eyebrow">Pair</p>
        <h2>Paste a nest code, scan a QR, or open a coop link.</h2>
        <p className="lede">
          This stays local to this browser. Once joined, anything already hatched here can queue
          into the extension&apos;s private intake.
        </p>
        <form
          className="receiver-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onReviewPairing(pairingInput);
          }}
        >
          <label className="receiver-label" htmlFor="pairing-payload">
            Nest code or coop link
          </label>
          <textarea
            id="pairing-payload"
            onChange={(event) => onPairingInputChange(event.target.value)}
            placeholder="coop-receiver:..., web+coop-receiver://..., or https://.../pair#payload=..."
            value={pairingInput}
          />
          <div className="cta-row">
            <button className="button button-primary" type="submit">
              Check nest code
            </button>
            <button
              className="button button-secondary"
              onClick={() => void onStartQrScanner()}
              type="button"
            >
              Scan QR
            </button>
            <button
              className="button button-secondary"
              onClick={onNavigateToReceiver}
              type="button"
            >
              Round up offline
            </button>
          </div>
        </form>
        {isQrScannerOpen ? (
          // biome-ignore lint/a11y/useSemanticElements: inline conditional overlay, not a modal dialog
          <div className="stack" role="dialog" aria-modal="true" aria-label="QR code scanner">
            <video autoPlay className="nest-photo" muted playsInline ref={qrVideoRef} />
            <div className="cta-row">
              <button
                className="button button-secondary"
                onClick={onStopQrScanner}
                ref={stopButtonRef}
                type="button"
              >
                Stop scanner
              </button>
            </div>
          </div>
        ) : null}
        {qrScanError ? <p className="receiver-error">{qrScanError}</p> : null}
        {pairingError ? <p className="receiver-error">{pairingError}</p> : null}
        {pendingPairing ? (
          <div className="stack">
            <p className="quiet-note">Check this code before this phone joins the private nest.</p>
            <div className="detail-grid">
              <div>
                <strong>Coop</strong>
                <p className="helper-text">{pendingPairing.coopDisplayName}</p>
              </div>
              <div>
                <strong>Member</strong>
                <p className="helper-text">{pendingPairing.memberDisplayName}</p>
              </div>
              <div>
                <strong>Issued</strong>
                <p className="helper-text">{new Date(pendingPairing.issuedAt).toLocaleString()}</p>
              </div>
              <div>
                <strong>Expires</strong>
                <p className="helper-text">{new Date(pendingPairing.expiresAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="cta-row">
              <button
                className="button button-primary"
                onClick={() => void onConfirmPairing()}
                type="button"
              >
                Join this coop
              </button>
              <button className="button button-secondary" onClick={onCancelPairing} type="button">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <article className="nest-card receiver-card">
        <p className="eyebrow">What this nest code adds</p>
        <ul className="check-list">
          <li>Device-local receiver identity</li>
          <li>Current coop and member context</li>
          <li>Private sync room details for extension intake</li>
          <li>Nothing publishes to shared coop memory automatically</li>
        </ul>
        <p className="quiet-note">
          Existing local captures stay local until a valid nest code is accepted, whether the
          extension is running locally or against the production PWA.
        </p>
      </article>
    </section>
  );
}
