import type { ArtifactCategory, ReviewDraftWorkflowStage } from '@coop/shared';

export type PopupScreen =
  | 'home'
  | 'create'
  | 'join'
  | 'drafts'
  | 'draft-detail'
  | 'feed'
  | 'settings'
  | 'coops';

export type PopupThemePreference = 'light' | 'dark' | 'system';

export type PopupResolvedTheme = Exclude<PopupThemePreference, 'system'>;

export interface PopupCreateFormState {
  coopName: string;
  creatorName: string;
  purpose: string;
  starterNote: string;
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

export interface PopupHomeQueueItem {
  id: string;
  title: string;
  summary: string;
  previewImageUrl?: string;
  category: ArtifactCategory;
  coopLabel: string;
  workflowStage: ReviewDraftWorkflowStage;
}

export type PopupFooterTab = 'home' | 'feed' | 'coops';
