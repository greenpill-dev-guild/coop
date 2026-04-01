import type { ReviewDraft } from '@coop/shared';
import { ErrorBoundary } from '../ErrorBoundary';
import { PopupCreateCoopScreen } from './PopupCreateCoopScreen';
import { PopupDraftDetailScreen } from './PopupDraftDetailScreen';
import { PopupDraftListScreen } from './PopupDraftListScreen';
import { PopupFeedScreen } from './PopupFeedScreen';
import { PopupHomeScreen } from './PopupHomeScreen';
import { PopupInviteHubScreen } from './PopupInviteHubScreen';
import { PopupInviteSuccessScreen } from './PopupInviteSuccessScreen';
import { PopupJoinCoopScreen } from './PopupJoinCoopScreen';
import { PopupJoinSuccessScreen } from './PopupJoinSuccessScreen';
import { PopupNoCoopScreen } from './PopupNoCoopScreen';
import { PopupProfilePanel } from './PopupProfilePanel';
import type { PopupOrchestrationState } from './hooks/usePopupOrchestration';

export function PopupScreenRouter({ state }: { state: PopupOrchestrationState }) {
  const { currentScreen } = state;

  if (currentScreen === 'no-coop') {
    return (
      <ErrorBoundary>
        <PopupNoCoopScreen
          onCreate={() => state.navigation.navigate('create')}
          onJoin={() => state.navigation.navigate('join')}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'create') {
    return (
      <ErrorBoundary>
        <PopupCreateCoopScreen
          form={state.navigation.state.createForm}
          onChange={state.navigation.setCreateForm}
          onPastePurpose={state.handlePasteCreatePurpose}
          onSubmit={state.handleCreateSubmit}
          submitting={state.createSubmitting}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'join') {
    return (
      <ErrorBoundary>
        <PopupJoinCoopScreen
          form={state.navigation.state.joinForm}
          onChange={state.navigation.setJoinForm}
          onPasteInviteCode={state.handlePasteJoinInviteCode}
          onSubmit={state.handleJoinSubmit}
          submitting={state.joinSubmitting}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'invites') {
    return (
      <ErrorBoundary>
        <PopupInviteHubScreen
          coops={state.inviteHubCoops}
          onShareInvite={state.openShareDialog}
          onCopyInvite={state.copyInviteCode}
          onRegenerateInvite={state.regenerateInviteCode}
          onRevokeInvite={state.revokeInviteType}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'invite-success') {
    return (
      <ErrorBoundary>
        <PopupInviteSuccessScreen
          coop={state.createdInviteCoop}
          onShareInvite={state.openShareDialog}
          onCopyInvite={state.copyInviteCode}
          onEnterCoop={state.enterCreatedCoop}
          onRegenerateInvite={state.regenerateInviteCode}
          onRevokeInvite={state.revokeInviteType}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'join-success') {
    return (
      <ErrorBoundary>
        <PopupJoinSuccessScreen coop={state.joinedCoop} onEnterCoop={state.enterJoinedCoop} />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'drafts') {
    return (
      <ErrorBoundary>
        <PopupDraftListScreen
          drafts={state.filteredDraftItems.map((draft) => ({
            ...draft,
            ...state.resolveDraftValue(draft as unknown as ReviewDraft),
          }))}
          filterTags={state.draftFilterTags}
          isCapturing={state.isRoundupInFlight}
          onMarkReady={state.handleMarkDraftReady}
          onOpenDraft={state.navigation.openDraft}
          onRoundUp={() => void state.captureActions.runManualCapture()}
          onShare={state.handleShareDraft}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'draft-detail' && state.selectedDraft) {
    return (
      <ErrorBoundary>
        <PopupDraftDetailScreen
          draft={state.selectedDraft}
          onChange={state.updateSelectedDraft}
          onSave={state.handleSaveSelectedDraft}
          onShare={state.handleShareSelectedDraft}
          onToggleReady={state.handleToggleSelectedDraftReady}
          saving={state.draftSaving}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'feed') {
    return (
      <ErrorBoundary>
        <PopupFeedScreen
          artifacts={state.visibleFeedArtifacts}
          filterTags={state.feedFilterTags}
          onDismissArtifact={state.dismissFeedArtifact}
          onOpenArtifact={(artifactId) => {
            state.setSelectedArtifactId(artifactId);
          }}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'profile' && state.dashboard) {
    return (
      <ErrorBoundary>
        <PopupProfilePanel
          accountLabel={state.accountLabel}
          coops={state.profileCoops}
          onSetAgentCadence={(minutes) =>
            void state.updateUiPreferences({ agentCadenceMinutes: minutes })
          }
          onSetTheme={state.theme.setThemePreference}
          onToggleNotifications={(enabled) =>
            void state.updateUiPreferences({ notificationsEnabled: enabled })
          }
          onToggleSound={state.updateSound}
          soundPreferences={state.dashboard.soundPreferences}
          themePreference={state.theme.themePreference}
          uiPreferences={state.dashboard.uiPreferences}
        />
      </ErrorBoundary>
    );
  }

  // Default: home screen
  return (
    <ErrorBoundary>
      <PopupHomeScreen
        audioStatus={state.recording.status}
        elapsedSeconds={state.recording.elapsedSeconds}
        isCapturing={state.isCapturing}
        isRoundupInFlight={state.isRoundupInFlight}
        isRecording={state.recording.isRecording}
        noteText={state.noteDraftText}
        onCancelRecording={state.recording.cancelRecording}
        onCaptureTab={() => void state.captureActions.runActiveTabCapture()}
        onChangeNote={state.setNoteDraftText}
        onFileSelected={(file: File) => void state.handlePrepareFileCapture(file)}
        onPaste={() => void state.handlePasteNote()}
        onRoundUp={() => void state.captureActions.runManualCapture()}
        onSaveNote={() => void state.handleSaveNote()}
        onScreenshot={() => void state.handlePrepareScreenshot()}
        onStartRecording={() => void state.recording.startRecording()}
        onStopRecording={state.recording.stopRecording}
        statusItems={state.homeStatusItems}
        yardItems={state.yardItems}
      />
    </ErrorBoundary>
  );
}
