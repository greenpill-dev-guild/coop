import {
  type ReceiverCapture,
  type ReceiverPairingRecord,
  getReceiverPairingStatus,
} from '@coop/shared';
import { ReceiverIntakeCard } from '../cards';
import type { useDraftEditor } from '../hooks/useDraftEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestReceiverSectionProps {
  createReceiverPairing: () => void;
  activeReceiverPairing: ReceiverPairingRecord | null;
  activeReceiverPairingStatus: ReturnType<typeof getReceiverPairingStatus> | null;
  visibleReceiverPairings: ReceiverPairingRecord[];
  selectReceiverPairing: (pairingId: string) => void;
  copyText: (label: string, value: string) => void;
  receiverIntake: ReceiverCapture[];
  draftEditor: ReturnType<typeof useDraftEditor>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestReceiverSection({
  createReceiverPairing,
  activeReceiverPairing,
  activeReceiverPairingStatus,
  visibleReceiverPairings,
  selectReceiverPairing,
  copyText,
  receiverIntake,
  draftEditor,
}: NestReceiverSectionProps) {
  return (
    <>
      {/* --- Receiver management --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Receiver Pairings</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Manage paired devices. Anything hatched on a phone lands here first.
          </p>
          <div className="action-row">
            <button className="primary-button" onClick={createReceiverPairing} type="button">
              Generate nest code
            </button>
          </div>
          {activeReceiverPairing ? (
            <div className="stack">
              {activeReceiverPairingStatus ? (
                <p className="helper-text">
                  Status: {activeReceiverPairingStatus.status} ·{' '}
                  {activeReceiverPairingStatus.message}
                </p>
              ) : null}
              <div className="field-grid">
                <label htmlFor="receiver-pairing-payload">Nest code</label>
                <textarea
                  id="receiver-pairing-payload"
                  readOnly
                  value={activeReceiverPairing.pairingCode ?? ''}
                />
              </div>
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={() =>
                    void copyText('Nest code', activeReceiverPairing.pairingCode ?? '')
                  }
                  type="button"
                >
                  Copy nest code
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void copyText('Pocket Coop link', activeReceiverPairing.deepLink ?? '')
                  }
                  type="button"
                >
                  Copy app link
                </button>
              </div>
              <div className="receiver-pairing-list">
                {visibleReceiverPairings.map((pairing) => (
                  <button
                    className={pairing.active ? 'inline-button' : 'secondary-button'}
                    key={pairing.pairingId}
                    onClick={() => void selectReceiverPairing(pairing.pairingId)}
                    type="button"
                  >
                    {pairing.memberDisplayName} · {getReceiverPairingStatus(pairing).status} ·{' '}
                    {pairing.lastSyncedAt
                      ? `Last sync ${new Date(pairing.lastSyncedAt).toLocaleString()}`
                      : 'Waiting for first sync'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              No nest code yet. Generate one, then open it in the companion app.
            </div>
          )}
        </div>
      </details>

      {/* --- Receiver intake --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Pocket Coop Finds</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">Things hatched on the phone land here first.</p>
          <div className="receiver-intake-list">
            {receiverIntake.map((capture) => (
              <ReceiverIntakeCard key={capture.id} capture={capture} draftEditor={draftEditor} />
            ))}
          </div>
          {receiverIntake.length === 0 ? (
            <div className="empty-state">
              No Pocket Coop finds yet. Once the companion app hatches a note, photo, or link and
              syncs, it lands here first.
            </div>
          ) : null}
        </div>
      </details>
    </>
  );
}
