import type { ReceiverCapture } from '@coop/shared';
import { useId } from 'react';

type SyncPillProps = {
  state: ReceiverCapture['syncState'];
};

function syncStateLabel(state: ReceiverCapture['syncState']) {
  switch (state) {
    case 'local-only':
      return 'Local only';
    case 'queued':
      return 'Queued';
    case 'synced':
      return 'Synced';
    case 'failed':
      return 'Failed';
  }
}

function syncDetailText(state: ReceiverCapture['syncState']) {
  switch (state) {
    case 'local-only':
      return 'Saved on this device only';
    case 'queued':
      return 'Waiting for connection';
    case 'synced':
      return 'Shared with your coop';
    case 'failed':
      return 'Sync failed — tap to retry';
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
