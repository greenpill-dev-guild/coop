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

function kindIcon(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return '\u{1F3B5}';
    case 'photo':
      return '\u{1F4F7}';
    case 'file':
      return '\u{1F4C4}';
    case 'link':
      return '\u{1F517}';
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function inboxSummary(captures: CaptureCard[]): string {
  let synced = 0;
  let pending = 0;
  let failed = 0;
  for (const c of captures) {
    const s = c.capture.syncState;
    if (s === 'synced') synced++;
    else if (s === 'failed') failed++;
    else pending++;
  }
  const parts: string[] = [];
  if (synced > 0) parts.push(`${synced} synced`);
  if (pending > 0) parts.push(`${pending} pending`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(' \u00B7 ');
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
        {captures.length > 0 ? (
          <div className="inbox-header">
            <span className="inbox-header__count">
              {captures.length} capture{captures.length !== 1 ? 's' : ''}
            </span>
            <span className="inbox-header__summary">{inboxSummary(captures)}</span>
          </div>
        ) : null}
        <div className="receiver-list">
          {captures.map((card) => (
            <article
              className={`nest-item-card nest-item-card--${card.capture.kind}${card.capture.id === hatchedCaptureId ? ' is-newborn' : ''}`}
              key={card.capture.id}
            >
              <div className="nest-item-topline">
                <span className={`nest-item-chick nest-item-chick--${card.capture.kind}`}>
                  {receiverItemLabel(card.capture.kind)}
                </span>
                <SyncPill state={card.capture.syncState} />
              </div>
              <strong className="nest-item-title">{card.capture.title}</strong>
              <p className="nest-item-meta">
                {formatTimestamp(card.capture.createdAt)} &middot;{' '}
                {sizeLabel(card.capture.byteSize)}
              </p>
              {isSafeExternalUrl(card.capture.sourceUrl) ? (
                <a
                  className="nest-item-link"
                  href={card.capture.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {card.capture.sourceUrl}
                </a>
              ) : card.capture.sourceUrl ? (
                <span className="nest-item-link">{card.capture.sourceUrl}</span>
              ) : null}
              {card.capture.kind === 'audio' && card.previewUrl ? (
                <div className="nest-audio-wrapper">
                  {/* biome-ignore lint/a11y/useMediaCaption: Local receiver previews do not have generated captions at capture time. */}
                  <audio controls src={card.previewUrl} />
                </div>
              ) : null}
              {card.capture.kind === 'photo' && card.previewUrl ? (
                <img alt={card.capture.title} className="nest-photo" src={card.previewUrl} />
              ) : null}
              {card.capture.kind === 'link' ? (
                <p className="nest-item-note">
                  {card.capture.note || 'Shared link saved locally.'}
                </p>
              ) : null}
              <div className="nest-item-actions">
                {card.capture.kind !== 'link' && card.previewUrl ? (
                  <Button
                    variant="secondary"
                    size="small"
                    className="nest-action-btn"
                    onClick={() => void onDownloadCapture(card)}
                  >
                    {kindIcon(card.capture.kind)} Download
                  </Button>
                ) : null}
                {canShare ? (
                  <Button
                    variant="secondary"
                    size="small"
                    className="nest-action-btn"
                    onClick={() => void onShareCapture(card)}
                  >
                    Share
                  </Button>
                ) : null}
                {card.capture.kind === 'link' && card.capture.sourceUrl ? (
                  <Button
                    variant="secondary"
                    size="small"
                    className="nest-action-btn"
                    onClick={() => void onCopyCaptureLink(card.capture)}
                  >
                    Copy link
                  </Button>
                ) : null}
              </div>
              {card.capture.syncError ? (
                <div className="nest-sync-error">
                  <span className="nest-sync-error__icon" aria-hidden="true">
                    !
                  </span>
                  <span>{card.capture.syncError}</span>
                </div>
              ) : null}
              {card.capture.syncState === 'failed' ? (
                <Button
                  variant="secondary"
                  size="small"
                  className="nest-retry-btn"
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
            <div className="empty-nest__illustration" aria-hidden="true" />
            <p className="empty-nest__title">Your Roost is empty</p>
            <p className="empty-nest__body">
              Head to Capture to hatch your first note, photo, or link. Everything you capture
              appears here.
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
