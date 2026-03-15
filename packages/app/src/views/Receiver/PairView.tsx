import type { ReceiverPairingPayload } from '@coop/shared';
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
            Nest code or coop link
          </label>
          <textarea
            id="pairing-payload"
            onChange={(event) => onPairingInputChange(event.target.value)}
            placeholder="coop-receiver:..., web+coop-receiver://..., or https://.../pair#payload=..."
            value={pairingInput}
          />
          <div className="cta-row">
            <Button variant="primary" type="submit">
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
            <video autoPlay className="nest-photo" muted playsInline ref={qrVideoRef} />
            <div className="cta-row">
              <button
                className="button button-secondary"
                onClick={onStopQrScanner}
                ref={qrStopButtonRef}
                type="button"
              >
                Stop scanner
              </button>
            </div>
          </dialog>
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
              <Button variant="primary" onClick={onConfirmPairing}>
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
      </Card>
    </section>
  );
}
