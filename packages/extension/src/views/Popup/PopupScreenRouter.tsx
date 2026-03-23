import { ErrorBoundary } from '../ErrorBoundary';
import { PopupCreateCoopScreen } from './PopupCreateCoopScreen';
import { PopupDraftDetailScreen } from './PopupDraftDetailScreen';
import { PopupDraftListScreen } from './PopupDraftListScreen';
import { PopupFeedScreen } from './PopupFeedScreen';
import { PopupHomeScreen } from './PopupHomeScreen';
import { PopupJoinCoopScreen } from './PopupJoinCoopScreen';
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
          onSubmit={state.handleJoinSubmit}
          submitting={state.joinSubmitting}
        />
      </ErrorBoundary>
    );
  }

  if (currentScreen === 'drafts') {
    return (
      <ErrorBoundary>
        <PopupDraftListScreen
          drafts={state.filteredDraftItems.map((draft) => ({
            ...draft,
            ...state.resolveDraftValue(draft),
          }))}
          filterTags={state.draftFilterTags}
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
          onCopyInviteCode={state.onCopyInviteCode}
          onCreate={state.openCreateFlow}
          onJoin={state.openJoinFlow}
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
        noteText={state.noteDraftText}
        onCaptureTab={() => void state.captureActions.runActiveTabCapture()}
        onChangeNote={state.setNoteDraftText}
        onOpenAudio={() => void state.openWorkspace({ targetCoopId: state.workspaceTargetCoopId })}
        onOpenFiles={() => void state.openWorkspace({ targetCoopId: state.workspaceTargetCoopId })}
        onPaste={() => void state.handlePasteNote()}
        onRoundUp={() => void state.captureActions.runManualCapture()}
        onSaveNote={state.handleSaveNote}
        onScreenshot={() => void state.captureActions.captureVisibleScreenshot()}
        statusItems={state.homeStatusItems}
        yardItems={state.yardItems}
      />
    </ErrorBoundary>
  );
}
