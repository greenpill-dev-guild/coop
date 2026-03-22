import { useMemo } from 'react';
import type {
  PopupCreateFormState,
  PopupFooterTab,
  PopupJoinFormState,
  PopupNavigationState,
  PopupScreen,
} from '../popup-types';
import { usePersistedPopupState } from './usePersistedPopupState';

const popupNavigationStorageKey = 'coop:popup-navigation';

const initialCreateForm: PopupCreateFormState = {
  coopName: '',
  creatorName: '',
  purpose: '',
  starterNote: '',
};

const initialJoinForm: PopupJoinFormState = {
  inviteCode: '',
  displayName: '',
  starterNote: '',
};

const initialNavigationState: PopupNavigationState = {
  screen: 'home',
  selectedDraftId: null,
  createForm: initialCreateForm,
  joinForm: initialJoinForm,
};

function normalizeScreen(screen: string | undefined): PopupScreen {
  switch (screen) {
    case 'create':
    case 'join':
    case 'drafts':
    case 'draft-detail':
    case 'feed':
    case 'profile':
      return screen;
    default:
      return 'home';
  }
}

export function usePopupNavigation() {
  const { state, loading, setState } = usePersistedPopupState<PopupNavigationState>(
    popupNavigationStorageKey,
    initialNavigationState,
  );
  const normalizedState = useMemo(
    () => ({
      ...state,
      screen: normalizeScreen((state as PopupNavigationState & { screen?: string }).screen),
      selectedDraftId: state.selectedDraftId ?? null,
      createForm: {
        ...initialCreateForm,
        ...state.createForm,
      },
      joinForm: {
        ...initialJoinForm,
        ...state.joinForm,
      },
    }),
    [state],
  );

  return useMemo(
    () => ({
      state: normalizedState,
      loading,
      navigate(screen: PopupScreen) {
        setState((current) => ({
          ...current,
          screen,
          selectedDraftId: screen === 'draft-detail' ? current.selectedDraftId : null,
        }));
      },
      goHome() {
        setState((current) => ({
          ...current,
          screen: 'home',
          selectedDraftId: null,
        }));
      },
      openDraft(draftId: string) {
        setState((current) => ({
          ...current,
          screen: 'draft-detail',
          selectedDraftId: draftId,
        }));
      },
      setCreateForm(patch: Partial<PopupCreateFormState>) {
        setState((current) => ({
          ...current,
          createForm: {
            ...current.createForm,
            ...patch,
          },
        }));
      },
      resetCreateForm() {
        setState((current) => ({
          ...current,
          createForm: initialCreateForm,
        }));
      },
      setJoinForm(patch: Partial<PopupJoinFormState>) {
        setState((current) => ({
          ...current,
          joinForm: {
            ...current.joinForm,
            ...patch,
          },
        }));
      },
      resetJoinForm() {
        setState((current) => ({
          ...current,
          joinForm: initialJoinForm,
        }));
      },
      navigateFooter(tab: PopupFooterTab) {
        setState((current) => ({
          ...current,
          screen: tab,
          selectedDraftId: null,
        }));
      },
    }),
    [loading, normalizedState, setState],
  );
}
