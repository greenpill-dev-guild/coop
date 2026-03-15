import type { ReceiverCapture } from '@coop/shared';

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

export function SyncPill({ state }: SyncPillProps) {
  return <span className={`sync-pill is-${state}`}>{syncStateLabel(state)}</span>;
}
