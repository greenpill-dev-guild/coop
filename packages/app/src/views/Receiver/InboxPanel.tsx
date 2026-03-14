import type { ReceiverCapture } from '@coop/shared';
import { isSafeExternalUrl } from '../../url-safety';
import type { CaptureCard } from './index';

export type InboxPanelProps = {
  captures: CaptureCard[];
  hatchedCaptureId: string | null;
  canShare: boolean;
  onShareCapture: (card: CaptureCard) => void;
  onDownloadCapture: (card: CaptureCard) => void;
  onCopyCaptureLink: (capture: ReceiverCapture) => void;
  onRetrySync: (captureId: string) => void;
  syncStateLabel: (state: ReceiverCapture['syncState']) => string;
  receiverItemLabel: (kind: ReceiverCapture['kind']) => string;
  sizeLabel: (byteSize: number) => string;
};

export function InboxPanel({
  captures,
  hatchedCaptureId,
  canShare,
  onShareCapture,
  onDownloadCapture,
  onCopyCaptureLink,
  onRetrySync,
  syncStateLabel,
  receiverItemLabel,
  sizeLabel,
}: InboxPanelProps) {
  return (
    <section className="receiver-grid">
      <article className="nest-card receiver-card receiver-inbox-card">
        <p className="eyebrow">Your Roost</p>
        <h2>Everything stays local until this nest is paired and one trusted browser syncs.</h2>
        <div className="receiver-list">
          {captures.map((card) => (
            <article
              className={
                card.capture.id === hatchedCaptureId
                  ? 'nest-item-card is-newborn'
                  : 'nest-item-card'
              }
              key={card.capture.id}
            >
              <div className="nest-item-topline">
                <span className="nest-item-chick">{receiverItemLabel(card.capture.kind)}</span>
                <span className={`sync-pill is-${card.capture.syncState}`}>
                  {syncStateLabel(card.capture.syncState)}
                </span>
              </div>
              <strong>{card.capture.title}</strong>
              <p>
                {new Date(card.capture.createdAt).toLocaleString()} ·{' '}
                {sizeLabel(card.capture.byteSize)}
              </p>
              {isSafeExternalUrl(card.capture.sourceUrl) ? (
                <a href={card.capture.sourceUrl} rel="noreferrer" target="_blank">
                  {card.capture.sourceUrl}
                </a>
              ) : card.capture.sourceUrl ? (
                <span>{card.capture.sourceUrl}</span>
              ) : null}
              {card.capture.kind === 'audio' && card.previewUrl ? (
                <>
                  {/* biome-ignore lint/a11y/useMediaCaption: Local receiver previews do not have generated captions at capture time. */}
                  <audio controls src={card.previewUrl} />
                </>
              ) : null}
              {card.capture.kind === 'photo' && card.previewUrl ? (
                <img alt={card.capture.title} className="nest-photo" src={card.previewUrl} />
              ) : null}
              {card.capture.kind === 'link' ? (
                <p>{card.capture.note || 'Shared link saved locally.'}</p>
              ) : null}
              {card.capture.kind !== 'link' && card.previewUrl ? (
                <button
                  className="button button-secondary button-small"
                  onClick={() => void onDownloadCapture(card)}
                  type="button"
                >
                  Download local file
                </button>
              ) : null}
              <div className="cta-row">
                {canShare ? (
                  <button
                    className="button button-secondary button-small"
                    onClick={() => void onShareCapture(card)}
                    type="button"
                  >
                    Share
                  </button>
                ) : null}
                {card.capture.kind === 'link' && card.capture.sourceUrl ? (
                  <button
                    className="button button-secondary button-small"
                    onClick={() => void onCopyCaptureLink(card.capture)}
                    type="button"
                  >
                    Copy link
                  </button>
                ) : null}
              </div>
              {card.capture.syncError ? (
                <p className="receiver-error">{card.capture.syncError}</p>
              ) : null}
              {card.capture.syncState === 'failed' ? (
                <button
                  className="button button-secondary button-small"
                  onClick={() => void onRetrySync(card.capture.id)}
                  type="button"
                >
                  Retry sync
                </button>
              ) : null}
            </article>
          ))}
        </div>
        {captures.length === 0 ? (
          <div className="empty-nest">
            Your Roost is empty. Head to Round Up to capture the first note, photo, or link.
          </div>
        ) : null}
      </article>
    </section>
  );
}
