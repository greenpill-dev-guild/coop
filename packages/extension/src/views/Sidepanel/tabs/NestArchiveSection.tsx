import type { CoopSharedState } from '@coop/shared';
import { ArchiveSetupWizard } from '../ArchiveSetupWizard';

// ---------------------------------------------------------------------------
// Save & Export props
// ---------------------------------------------------------------------------

export interface NestArchiveSectionProps {
  archiveSnapshot: () => Promise<void>;
  exportSnapshot: (format: 'json' | 'text') => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
}

// ---------------------------------------------------------------------------
// Save & Export
// ---------------------------------------------------------------------------

export function NestArchiveSection({
  archiveSnapshot,
  exportSnapshot,
  exportLatestReceipt,
}: NestArchiveSectionProps) {
  return (
    <article className="panel-card">
      <h2>Save and Export</h2>
      <div className="action-row">
        <button className="primary-button" onClick={archiveSnapshot} type="button">
          Save Coop Snapshot
        </button>
        <button className="secondary-button" onClick={() => exportSnapshot('json')} type="button">
          Export JSON snapshot
        </button>
        <button
          className="secondary-button"
          onClick={() => exportLatestReceipt('json')}
          type="button"
        >
          Export saved proof JSON
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Archive Setup Wizard props
// ---------------------------------------------------------------------------

export interface NestArchiveWizardSectionProps {
  activeCoop: CoopSharedState | undefined;
  loadDashboard: () => Promise<void>;
  setMessage: (msg: string) => void;
}

// ---------------------------------------------------------------------------
// Archive Setup Wizard
// ---------------------------------------------------------------------------

export function NestArchiveWizardSection({
  activeCoop,
  loadDashboard,
  setMessage,
}: NestArchiveWizardSectionProps) {
  if (!activeCoop) return null;

  return (
    <ArchiveSetupWizard
      coopId={activeCoop.profile.id}
      coopName={activeCoop.profile.name}
      archiveConfig={activeCoop.archiveConfig}
      onComplete={loadDashboard}
      setMessage={setMessage}
    />
  );
}
