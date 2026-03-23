import { PopupArtifactDialog } from './PopupArtifactDialog';
import { PopupBlockingNotice } from './PopupBlockingNotice';
import { PopupFooterNav } from './PopupFooterNav';
import { PopupHeader } from './PopupHeader';
import { PopupScreenRouter } from './PopupScreenRouter';
import { PopupShell } from './PopupShell';
import { headerTitleForScreen } from './helpers';
import { usePopupOrchestration } from './hooks/usePopupOrchestration';

export function PopupApp() {
  const state = usePopupOrchestration();

  const header = (
    <PopupHeader
      brandActionLabel="Play coop sound"
      brandTooltip="Play coop sound"
      onBack={
        ['create', 'join', 'draft-detail', 'profile'].includes(state.currentScreen)
          ? state.navigateBack
          : undefined
      }
      onBrandAction={state.playBrandSound}
      onCreateCoop={state.showCreateJoinInHeader ? state.openCreateFlow : undefined}
      onJoinCoop={state.showCreateJoinInHeader ? state.openJoinFlow : undefined}
      onOpenProfile={state.showProfileAction ? state.openProfilePanel : undefined}
      onSetTheme={state.theme.setThemePreference}
      onToggleWorkspace={
        state.showWorkspaceAction
          ? () => void state.toggleWorkspace(state.workspaceTargetCoopId)
          : undefined
      }
      profileOpen={state.currentScreen === 'profile'}
      themePreference={state.theme.themePreference}
      title={headerTitleForScreen(state.currentScreen)}
      workspaceCanClose={state.workspaceState.canClose}
      workspaceOpen={state.workspaceState.open}
    />
  );

  const blockingOverlay =
    !state.dashboard && state.dashboardError ? (
      <PopupBlockingNotice
        message={state.dashboardError}
        onRetry={() => void state.loadDashboard()}
        title="Couldn't load Coop."
      />
    ) : null;

  const artifactOverlay = state.selectedArtifact ? (
    <PopupArtifactDialog
      artifact={state.selectedArtifact}
      onClose={() => state.setSelectedArtifactId(null)}
      onOpenInSidepanel={async () => {
        await state.openWorkspace({ targetCoopId: state.selectedArtifact?.coopIds[0] });
        state.setSelectedArtifactId(null);
      }}
    />
  ) : null;

  const hasFooter = state.currentScreen !== 'no-coop' && state.currentScreen !== 'profile';
  const footer = hasFooter ? (
    <PopupFooterNav
      activeTab={state.activeFooterTab}
      draftsBadgeCount={state.visibleDrafts.length}
      feedBadgeCount={state.visibleFeedArtifacts.length}
      onNavigate={(tab) => {
        state.setSelectedArtifactId(null);
        if (tab === 'home') {
          state.navigation.goHome();
          return;
        }
        state.navigation.navigateFooter(tab);
      }}
    />
  ) : null;

  return (
    <PopupShell
      footer={footer}
      header={header}
      message={state.message}
      overlay={artifactOverlay ?? blockingOverlay}
      theme={state.theme.resolvedTheme}
    >
      <PopupScreenRouter state={state} />
    </PopupShell>
  );
}
