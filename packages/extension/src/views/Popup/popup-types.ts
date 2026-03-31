import type {
  Artifact,
  ArtifactCategory,
  InviteType,
  ReviewDraftWorkflowStage,
} from '@coop/shared';

export type PopupScreen =
  | 'home'
  | 'create'
  | 'join'
  | 'invites'
  | 'invite-success'
  | 'drafts'
  | 'draft-detail'
  | 'feed'
  | 'profile';

export type PopupThemePreference = 'light' | 'dark' | 'system';

export type PopupResolvedTheme = Exclude<PopupThemePreference, 'system'>;

export interface PopupCreateFormState {
  coopName: string;
  creatorName: string;
  purpose: string;
  starterNote: string;
  enableGreenGoods?: boolean;
}

export interface PopupJoinFormState {
  inviteCode: string;
  displayName: string;
  starterNote: string;
}

export interface PopupNavigationState {
  screen: PopupScreen;
  selectedDraftId: string | null;
  createForm: PopupCreateFormState;
  joinForm: PopupJoinFormState;
}

export interface PopupActivityItem {
  id: string;
  title: string;
  meta: string;
  status: string;
  kind: 'draft' | 'artifact';
}

export interface PopupDraftListItem {
  id: string;
  title: string;
  summary: string;
  previewImageUrl?: string;
  category: ArtifactCategory;
  tags?: string[];
  coopLabel: string;
  coopIds: string[];
  workflowStage: ReviewDraftWorkflowStage;
  whyItMatters?: string;
  suggestedNextStep?: string;
  createdAt?: string;
  sourceUrl?: string;
  sourceDomain?: string;
}

export interface PopupFeedArtifactItem extends Artifact {
  coopLabel: string;
  coopIds: string[];
}

export interface PopupChoiceOption<T extends string | number> {
  id: T;
  label: string;
}

export interface PopupInviteCardItem {
  inviteType: InviteType;
  status: 'active' | 'used' | 'expired' | 'revoked' | 'missing';
  code?: string;
  expiresAt?: string;
  usedCount: number;
}

export interface PopupInviteCoopItem {
  coopId: string;
  coopName: string;
  memberId?: string;
  memberRoleLabel?: string;
  canManageInvites: boolean;
  memberInvite: PopupInviteCardItem;
  trustedInvite: PopupInviteCardItem;
}

export interface PopupHomeNoteState {
  text: string;
  updatedAt?: string;
}

export type PopupFooterTab = 'home' | 'drafts' | 'feed';

export interface PopupPendingCapture {
  kind: 'audio' | 'photo' | 'file';
  title: string;
  note: string;
  mimeType: string;
  fileName?: string;
  sourceUrl?: string;
  durationSeconds?: number;
  byteSize: number;
  dataBase64?: string;
  blob?: Blob;
  previewUrl?: string;
}
