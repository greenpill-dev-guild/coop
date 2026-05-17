import type { ReceiverCapture } from '@coop/shared/app';
import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
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
  onRemoveCapture: (capture: ReceiverCapture) => void;
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
  onRemoveCapture,
  onRetrySync,
}: InboxViewProps) {
  const [actionCard, setActionCard] = useState<CaptureCard | null>(null);

  return (
    <section className="receiver-grid" data-qa="roost-screen">
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
              data-qa="roost-item"
              data-sync-state={card.capture.syncState}
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
              <div className="receiver-item-actions">
                <Button
                  variant="secondary"
                  size="small"
                  data-qa="more-actions"
                  onClick={() => setActionCard(card)}
                >
                  More actions
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  data-qa="remove-item"
                  onClick={() => void onRemoveCapture(card.capture)}
                >
                  Remove
                </Button>
                {card.capture.syncState === 'failed' ? (
                  <Button
                    variant="secondary"
                    size="small"
                    data-qa="retry-sync"
                    onClick={() => void onRetrySync(card.capture.id)}
                  >
                    Retry sync
                  </Button>
                ) : null}
              </div>
              {card.capture.syncError ? (
                <p className="receiver-error">{card.capture.syncError}</p>
              ) : null}
            </article>
          ))}
        </div>
        {captures.length === 0 ? (
          <div className="empty-nest">
            Your inbox is empty. Head to Hatch to save the first note, photo, or link.
          </div>
        ) : null}
      </Card>
      <BottomSheet
        open={Boolean(actionCard)}
        onClose={() => setActionCard(null)}
        title={actionCard ? `Actions for ${actionCard.capture.title}` : 'Capture actions'}
      >
        {actionCard ? (
          <div className="receiver-action-sheet-list">
            {canShare ? (
              <Button
                variant="secondary"
                data-qa="share-item"
                onClick={() => {
                  void onShareCapture(actionCard);
                  setActionCard(null);
                }}
              >
                Share
              </Button>
            ) : null}
            {actionCard.capture.kind !== 'link' && actionCard.previewUrl ? (
              <Button
                variant="secondary"
                data-qa="download-item"
                onClick={() => {
                  void onDownloadCapture(actionCard);
                  setActionCard(null);
                }}
              >
                Download local file
              </Button>
            ) : null}
            {actionCard.capture.kind === 'link' && actionCard.capture.sourceUrl ? (
              <Button
                variant="secondary"
                data-qa="copy-link"
                onClick={() => {
                  void onCopyCaptureLink(actionCard.capture);
                  setActionCard(null);
                }}
              >
                Copy link
              </Button>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}
