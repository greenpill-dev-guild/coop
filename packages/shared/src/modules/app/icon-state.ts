import type { ExtensionIconState } from '../../contracts/schema';

export interface IconStateInput {
  pendingDrafts: number;
  watching: boolean;
  offline: boolean;
  missingPermission: boolean;
  syncError: boolean;
}

export function deriveExtensionIconState(input: IconStateInput): ExtensionIconState {
  if (input.offline || input.missingPermission || input.syncError) {
    return 'error-offline';
  }
  if (input.pendingDrafts > 0) {
    return 'review-needed';
  }
  if (input.watching) {
    return 'watching';
  }
  return 'idle';
}

export function extensionIconStateLabel(state: ExtensionIconState) {
  switch (state) {
    case 'idle':
      return 'Idle';
    case 'watching':
      return 'Watching';
    case 'review-needed':
      return 'Review Needed';
    case 'error-offline':
      return 'Error / Offline';
  }
}

export function extensionIconBadge(state: ExtensionIconState) {
  switch (state) {
    case 'idle':
      return { text: 'IDLE', color: '#4f2e1f' };
    case 'watching':
      return { text: 'SCAN', color: '#5a7d10' };
    case 'review-needed':
      return { text: 'ROST', color: '#fd8a01' };
    case 'error-offline':
      return { text: 'ERR', color: '#a63b20' };
  }
}
