import type { ReceiverCapture } from '@coop/shared/app';
import { useId } from 'react';

type SyncPillProps = {
  state: ReceiverCapture['syncState'];
};

function syncStateLabel(state: ReceiverCapture['syncState']) {
  switch (state) {
    case 'local-only':
      return 'Saved on this phone';
    case 'queued':
      return 'Waiting to sync';
    case 'synced':
      return 'In private intake';
    case 'failed':
      return 'Needs retry';
  }
}

function syncDetailText(state: ReceiverCapture['syncState']) {
  switch (state) {
    case 'local-only':
      return 'Saved on this phone. Pair when you are ready to sync.';
    case 'queued':
      return 'Waiting for the paired browser to receive it.';
    case 'synced':
      return 'Sent to private intake. Nothing publishes automatically.';
    case 'failed':
      return 'Open Roost and tap Retry sync.';
  }
}

export function SyncPill({ state }: SyncPillProps) {
  const id = useId();
  return (
    <>
      <button type="button" className={`sync-pill is-${state}`} popoverTarget={id}>
        {syncStateLabel(state)}
      </button>
      <div id={id} popover="auto" className="sync-pill-popover">
        {syncDetailText(state)}
      </div>
    </>
  );
}
