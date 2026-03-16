import type { CoopArchiveConfig } from '@coop/shared';
import { useRef, useState } from 'react';
import { sendRuntimeMessage } from '../../runtime/messages';

type WizardStep = 'email' | 'verify' | 'done';

interface ArchiveSetupWizardProps {
  coopId: string;
  coopName: string;
  archiveConfig?: CoopArchiveConfig;
  onComplete: () => void | Promise<void>;
  setMessage: (msg: string) => void;
}

const VERIFY_TIMEOUT_MS = 5 * 60 * 1000;

export function ArchiveSetupWizard({
  coopId,
  coopName,
  archiveConfig,
  onComplete,
  setMessage,
}: ArchiveSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('email');
  const [email, setEmail] = useState('');
  const [spaceDid, setSpaceDid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // If already configured, show status instead of wizard
  if (archiveConfig) {
    return (
      <article className="panel-card">
        <h2>Filecoin Archiving</h2>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Status</strong>
            <p className="helper-text">Live</p>
          </div>
          <div>
            <strong>Space</strong>
            <p className="helper-text" title={archiveConfig.spaceDid}>
              {archiveConfig.spaceDid.length > 24
                ? `${archiveConfig.spaceDid.slice(0, 12)}...${archiveConfig.spaceDid.slice(-8)}`
                : archiveConfig.spaceDid}
            </p>
          </div>
          <div>
            <strong>Gateway</strong>
            <p className="helper-text">{archiveConfig.gatewayBaseUrl}</p>
          </div>
        </div>
        <div className="action-row">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void sendRuntimeMessage({
                type: 'remove-coop-archive-config',
                payload: { coopId },
              }).then(async (result) => {
                setMessage(
                  result.ok
                    ? 'Filecoin archiving disconnected.'
                    : (result.error ?? 'Could not disconnect.'),
                );
                await onComplete();
              });
            }}
          >
            Disconnect
          </button>
        </div>
      </article>
    );
  }

  async function handleStartProvision() {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setError('');
    setBusy(true);
    setStep('verify');

    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => {
      controller.abort();
    }, VERIFY_TIMEOUT_MS);

    try {
      const result = await sendRuntimeMessage<{ spaceDid: string }>({
        type: 'provision-archive-space',
        payload: { coopId, email: email.trim(), coopName },
      });

      clearTimeout(timeout);

      if (!result.ok || !result.data) {
        setError(result.error ?? 'Provisioning failed.');
        setStep('email');
        setBusy(false);
        return;
      }

      setSpaceDid(result.data.spaceDid);
      setStep('done');
      setBusy(false);
      setMessage('Filecoin archiving is live.');
      await onComplete();
    } catch (err) {
      clearTimeout(timeout);
      const detail =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Email verification timed out. Try again.'
          : err instanceof Error
            ? err.message
            : 'Provisioning failed.';
      setError(detail);
      setStep('email');
      setBusy(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStep('email');
    setError('');
  }

  return (
    <article className="panel-card">
      <h2>Filecoin Archiving</h2>

      {step === 'email' && (
        <>
          <p className="helper-text">
            Connect a Storacha space so this coop can archive shared finds and snapshots to
            Filecoin. Enter the email address you use (or want to use) with Storacha.
          </p>
          <div className="field-grid">
            <label htmlFor="archive-setup-email">Email</label>
            <input
              id="archive-setup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <p className="helper-text">Free: 5GB &middot; Paid: ~$0.01/GB/mo</p>
          {error ? (
            <p className="helper-text" style={{ color: 'var(--error)' }}>
              {error}
            </p>
          ) : null}
          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => void handleStartProvision()}
              disabled={busy}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {step === 'verify' && (
        <>
          <p className="helper-text">
            Check your email for a verification link from Storacha. Click it to confirm, then this
            wizard will auto-advance.
          </p>
          <div className="helper-text" style={{ textAlign: 'center', padding: '1rem 0' }}>
            Waiting for email verification...
          </div>
          {error ? (
            <p className="helper-text" style={{ color: 'var(--error)' }}>
              {error}
            </p>
          ) : null}
          <div className="action-row">
            <button className="secondary-button" type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Status</strong>
            <p className="helper-text">Archiving is live</p>
          </div>
          <div>
            <strong>Space</strong>
            <p className="helper-text" title={spaceDid}>
              {spaceDid.length > 24 ? `${spaceDid.slice(0, 12)}...${spaceDid.slice(-8)}` : spaceDid}
            </p>
          </div>
          <div>
            <strong>Gateway</strong>
            <p className="helper-text">https://storacha.link</p>
          </div>
        </div>
      )}
    </article>
  );
}
