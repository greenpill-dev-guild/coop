export type PopupScreen =
  | 'home'
  | 'create'
  | 'join'
  | 'drafts'
  | 'draft-detail'
  | 'feed'
  | 'settings'
  | 'switcher';

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
