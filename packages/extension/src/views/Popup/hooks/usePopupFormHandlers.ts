import { clipboardPasteFallbackMessage, pasteClipboardText } from '@coop/shared';
import { useState } from 'react';
import type { useCoopActions } from '../../shared/useCoopActions';
import type { PopupFooterTab } from '../popup-types';
import type { usePopupNavigation } from './usePopupNavigation';

export interface PopupFormHandlersDeps {
  navigation: ReturnType<typeof usePopupNavigation>;
  coopActions: ReturnType<typeof useCoopActions>;
  subscreenReturnTab: PopupFooterTab;
  setMessage: (message: string) => void;
  onCreateSuccess: (coopId: string) => void;
  onJoinSuccess: (coopId: string) => void;
}

export function usePopupFormHandlers(deps: PopupFormHandlersDeps) {
  const { navigation, coopActions, setMessage, onCreateSuccess, onJoinSuccess } = deps;
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);

  async function handleCreateSubmit() {
    setCreateSubmitting(true);
    const created = await coopActions.createCoop(navigation.state.createForm);
    setCreateSubmitting(false);
    if (!created) {
      return;
    }
    navigation.resetCreateForm();
    onCreateSuccess(created.profile.id);
  }

  async function handleJoinSubmit() {
    setJoinSubmitting(true);
    const joined = await coopActions.joinCoop(navigation.state.joinForm);
    setJoinSubmitting(false);
    if (!joined) {
      return;
    }
    navigation.resetJoinForm();
    onJoinSuccess(joined.profile?.id ?? '');
  }

  async function handlePasteCreatePurpose() {
    const result = await pasteClipboardText({
      currentValue: navigation.state.createForm.purpose,
      mode: 'append',
    });
    if (result.status === 'success') {
      navigation.setCreateForm({ purpose: result.value });
      return;
    }
    if (result.status === 'unavailable') {
      setMessage(clipboardPasteFallbackMessage);
    }
  }

  async function handlePasteJoinInviteCode() {
    const result = await pasteClipboardText({
      currentValue: navigation.state.joinForm.inviteCode,
      mode: 'keep-last-block',
    });
    if (result.status === 'success') {
      navigation.setJoinForm({ inviteCode: result.value });
      return;
    }
    if (result.status === 'unavailable') {
      setMessage(clipboardPasteFallbackMessage);
    }
  }

  return {
    createSubmitting,
    joinSubmitting,
    handleCreateSubmit,
    handleJoinSubmit,
    handlePasteCreatePurpose,
    handlePasteJoinInviteCode,
  };
}
