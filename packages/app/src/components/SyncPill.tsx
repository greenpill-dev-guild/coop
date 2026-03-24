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

const ICON_PROPS = {
  width: 14,
  height: 14,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 14 14',
  'aria-hidden': true as const,
};

function SyncIcon({ state }: { state: ReceiverCapture['syncState'] }) {
  switch (state) {
    case 'synced':
      return (
        <svg {...ICON_PROPS}>
          <circle cx="7" cy="7" r="5.5" />
          <path d="M4.8 7.2 6.2 8.6 9.2 5.4" />
        </svg>
      );
    case 'queued':
      return (
        <svg {...ICON_PROPS}>
          <circle cx="7" cy="7" r="5.5" />
          <path d="M7 4.2V7l2.2 1.3" />
        </svg>
      );
    case 'failed':
      return (
        <svg {...ICON_PROPS}>
          <path d="M7 2.2 12.3 11.5H1.7Z" />
          <path d="M7 6v2" />
          <circle cx="7" cy="9.8" r="0.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'local-only':
      return (
        <svg {...ICON_PROPS}>
          <rect x="3.5" y="1.5" width="7" height="11" rx="1.5" />
          <line x1="5.5" y1="10.5" x2="8.5" y2="10.5" />
        </svg>
      );
  }
}

export function SyncPill({ state }: SyncPillProps) {
  const id = useId();
  return (
    <>
      <button type="button" className={`sync-pill is-${state}`} popoverTarget={id}>
        <SyncIcon state={state} />
        {syncStateLabel(state)}
      </button>
      <div id={id} popover="auto" className="sync-pill-popover">
        <span className="sync-pill-popover-arrow" />
        {syncDetailText(state)}
      </div>
    </>
  );
}
