import type { ReceiverPairingPayload } from '@coop/shared/app';
import { type RefObject, useEffect, useState } from 'react';
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
  const [pasteOpen, setPasteOpen] = useState(() =>
    Boolean(pairingInput || pairingError || pendingPairing),
  );

  useEffect(() => {
    if (pairingInput || pairingError || pendingPairing) {
      setPasteOpen(true);
    }
  }, [pairingError, pairingInput, pendingPairing]);

  return (
    <section className="receiver-grid">
      <Card>
        <p className="eyebrow">Mate</p>
        <h2>Mate this phone to a trusted Coop browser.</h2>
        <p className="lede">
          Scan the QR from your browser extension. Anything already saved here can sync after you
          join.
        </p>
        <div className="cta-row pair-cta-row">
          <Button
            variant="primary"
            onClick={() => void onStartQrScanner()}
            className="pair-cta-primary"
          >
            Scan QR
          </Button>
          <Button variant="secondary" onClick={() => setPasteOpen((open) => !open)}>
            Paste code
          </Button>
          <Button variant="secondary" onClick={onNavigateHatch}>
            Continue without pairing
          </Button>
        </div>
        {pasteOpen ? (
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
            <Button variant="primary" type="submit">
              Check nest code
            </Button>
          </form>
        ) : null}
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
        <details className="pair-trust-disclosure">
          <summary>What pairing adds</summary>
          <ul className="pair-checklist">
            <li>
              {CheckIcon}
              <span>This phone&apos;s receiver identity</span>
            </li>
            <li>
              {CheckIcon}
              <span>Coop and member context</span>
            </li>
            <li>
              {CheckIcon}
              <span>Private intake sync details</span>
            </li>
            <li>
              {CheckIcon}
              <span>No automatic publishing</span>
            </li>
          </ul>
          <p className="quiet-note">
            Existing captures stay saved on this phone until a valid nest code is accepted.
          </p>
        </details>
      </Card>
    </section>
  );
}
