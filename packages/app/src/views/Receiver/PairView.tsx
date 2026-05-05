import type { ReceiverPairingPayload } from '@coop/shared/app';
import type { RefObject } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';

type PairViewProps = {
  pairingInput: string;
  onPairingInputChange: (value: string) => void;
  onReviewPairing: (input: string) => void;
  onStartQrScanner: () => void;
  onStopQrScanner: () => void;
  onNavigateHatch: () => void;
  isQrScannerOpen: boolean;
  qrScanError: string;
  qrVideoRef: RefObject<HTMLVideoElement | null>;
  qrDialogRef: RefObject<HTMLDialogElement | null>;
  qrStopButtonRef: RefObject<HTMLButtonElement | null>;
  pairingError: string;
  pendingPairing: ReceiverPairingPayload | null;
  onConfirmPairing: () => void;
  onCancelPairing: () => void;
};

const LockIcon = (
  <svg
    className="receiver-label__icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CloseIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AlertIcon = (
  <svg
    className="pair-error-banner__icon"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const ShieldIcon = (
  <svg
    className="pair-confirm-header__icon"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function PairView({
  pairingInput,
  onPairingInputChange,
  onReviewPairing,
  onStartQrScanner,
  onStopQrScanner,
  onNavigateHatch,
  isQrScannerOpen,
  qrScanError,
  qrVideoRef,
  qrDialogRef,
  qrStopButtonRef,
  pairingError,
  pendingPairing,
  onConfirmPairing,
  onCancelPairing,
}: PairViewProps) {
  return (
    <section className="receiver-grid">
      <Card>
        <p className="eyebrow">Mate</p>
        <h2>Paste a nest code, scan a QR, or open a coop link.</h2>
        <p className="lede">
          This stays local to this browser. Once joined, anything already hatched here can queue
          into the extension&apos;s private intake.
        </p>
        <form
          className="receiver-form"
          onSubmit={(event) => {
            event.preventDefault();
            onReviewPairing(pairingInput);
          }}
        >
          <label className="receiver-label" htmlFor="pairing-payload">
            {LockIcon}
            Nest code or coop link
          </label>
          <textarea
            id="pairing-payload"
            onChange={(event) => onPairingInputChange(event.target.value)}
            placeholder="coop-receiver:..., web+coop-receiver://..., or https://.../pair#payload=..."
            value={pairingInput}
          />
          <div className="cta-row pair-cta-row">
            <Button variant="primary" type="submit" className="pair-cta-primary">
              Check nest code
            </Button>
            <Button variant="secondary" onClick={() => void onStartQrScanner()}>
              Scan QR
            </Button>
            <Button variant="secondary" onClick={onNavigateHatch}>
              Hatch offline
            </Button>
          </div>
        </form>
        {isQrScannerOpen ? (
          <dialog
            className="qr-scanner-dialog"
            ref={qrDialogRef}
            aria-label="QR code scanner"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onStopQrScanner();
              }
            }}
            onClose={onStopQrScanner}
          >
            <div className="qr-scanner-viewport">
              <video autoPlay className="nest-photo" muted playsInline ref={qrVideoRef} />
              <div className="qr-viewfinder" aria-hidden="true" />
            </div>
            <button
              className="qr-scanner-close"
              onClick={onStopQrScanner}
              ref={qrStopButtonRef}
              type="button"
              aria-label="Close scanner"
            >
              {CloseIcon}
            </button>
          </dialog>
        ) : null}
        {qrScanError ? (
          <div className="pair-error-banner" role="alert">
            {AlertIcon}
            <span>{qrScanError}</span>
          </div>
        ) : null}
        {pairingError ? (
          <div className="pair-error-banner" role="alert">
            {AlertIcon}
            <span>{pairingError}</span>
          </div>
        ) : null}
        {pendingPairing ? (
          <div className="pair-confirm-card">
            <div className="pair-confirm-header">
              {ShieldIcon}
              <p className="quiet-note">
                Check this code before this phone joins the private nest.
              </p>
            </div>
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
              <Button variant="primary" onClick={onConfirmPairing} className="pair-join-button">
                Join this coop
              </Button>
              <Button variant="secondary" onClick={onCancelPairing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="pair-info-card">
          <p className="eyebrow">What this nest code adds</p>
          <ul className="pair-checklist">
            <li>
              {CheckIcon}
              <span>Device-local receiver identity</span>
            </li>
            <li>
              {CheckIcon}
              <span>Current coop and member context</span>
            </li>
            <li>
              {CheckIcon}
              <span>Private sync room details for extension intake</span>
            </li>
            <li>
              {CheckIcon}
              <span>Nothing publishes to shared coop memory automatically</span>
            </li>
          </ul>
          <p className="quiet-note">
            Existing local captures stay local until a valid nest code is accepted, whether the
            extension is running locally or against the production PWA.
          </p>
        </div>
      </Card>
    </section>
  );
}
