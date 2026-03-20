import type { ReceiverCapture } from '@coop/shared';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { SyncPill } from '../../components/SyncPill';
import { isSafeExternalUrl } from '../../url-safety';
import { sizeLabel } from './format';
import type { CaptureCard } from './index';

type InboxViewProps = {
  captures: CaptureCard[];
  hatchedCaptureId: string | null;
  canShare: boolean;
  onShareCapture: (card: CaptureCard) => void;
  onCopyCaptureLink: (capture: ReceiverCapture) => void;
  onDownloadCapture: (card: CaptureCard) => void;
  onRetrySync: (captureId: string) => void;
};

function receiverItemLabel(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return 'Voice chick';
    case 'photo':
      return 'Photo chick';
    case 'file':
      return 'File chick';
    case 'link':
      return 'Link chick';
  }
}

export function InboxView({
  captures,
  hatchedCaptureId,
  canShare,
  onShareCapture,
  onCopyCaptureLink,
  onDownloadCapture,
  onRetrySync,
}: InboxViewProps) {
  return (
    <section className="receiver-grid">
      <Card className="receiver-inbox-card">
        <p className="eyebrow">Your Roost</p>
        <h2>Everything stays local until this nest is mated and one trusted browser syncs.</h2>
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
                <SyncPill state={card.capture.syncState} />
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
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void onDownloadCapture(card)}
                >
                  Download local file
                </Button>
              ) : null}
              <div className="cta-row">
                {canShare ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => void onShareCapture(card)}
                  >
                    Share
                  </Button>
                ) : null}
                {card.capture.kind === 'link' && card.capture.sourceUrl ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => void onCopyCaptureLink(card.capture)}
                  >
                    Copy link
                  </Button>
                ) : null}
              </div>
              {card.capture.syncError ? (
                <p className="receiver-error">{card.capture.syncError}</p>
              ) : null}
              {card.capture.syncState === 'failed' ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void onRetrySync(card.capture.id)}
                >
                  Retry sync
                </Button>
              ) : null}
            </article>
          ))}
        </div>
        {captures.length === 0 ? (
          <div className="empty-nest">
            Your inbox is empty. Head to Capture to hatch the first note, photo, or link.
          </div>
        ) : null}
      </Card>
    </section>
  );
}
