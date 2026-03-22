import type { Artifact, ArtifactCategory, ReviewDraftWorkflowStage } from '@coop/shared';

export type PopupScreen =
  | 'home'
  | 'create'
  | 'join'
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
  coopLabel: string;
  coopIds: string[];
  workflowStage: ReviewDraftWorkflowStage;
}

export interface PopupFeedArtifactItem extends Artifact {
  coopLabel: string;
  coopIds: string[];
}

export interface PopupChoiceOption<T extends string | number> {
  id: T;
  label: string;
}

export interface PopupHomeNoteState {
  text: string;
  updatedAt?: string;
}

export type PopupFooterTab = 'home' | 'drafts' | 'feed';
