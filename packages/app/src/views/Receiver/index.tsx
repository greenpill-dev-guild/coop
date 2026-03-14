import type { ReceiverCapture } from '@coop/shared';

export type CaptureCard = {
  capture: ReceiverCapture;
  previewUrl?: string;
};

export { CapturePanel } from './CapturePanel';
export type { CapturePanelProps } from './CapturePanel';
export { InboxPanel } from './InboxPanel';
export type { InboxPanelProps } from './InboxPanel';
export { PairingPanel } from './PairingPanel';
export type { PairingPanelProps } from './PairingPanel';
export { SettingsPanel } from './SettingsPanel';
export type { SettingsPanelProps } from './SettingsPanel';
