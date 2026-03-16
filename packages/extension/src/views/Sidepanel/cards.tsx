import {
  type CoopSharedState,
  type ReceiverCapture,
  type ReviewDraft,
  artifactCategorySchema,
  isArchiveWorthy,
} from '@coop/shared';
import type { InferenceBridgeState } from '../../runtime/inference-bridge';
import type { DashboardResponse } from '../../runtime/messages';
import {
  formatArtifactCategoryLabel,
  formatReviewStatusLabel,
  formatSaveStatusLabel,
  formatSavedProofMode,
  formatSavedProofScope,
  formatSavedProofStatus,
  getAnchorExplorerUrl,
  getFilfoxDealUrl,
  getFilfoxProviderUrl,
  getFvmExplorerTxUrl,
  truncateCid,
} from './helpers';
import type { useDraftEditor } from './hooks/useDraftEditor';

// ---------------------------------------------------------------------------
// Shared hook return types (extracted for prop typing)
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;

// ---------------------------------------------------------------------------
// DraftCard
// ---------------------------------------------------------------------------

export interface DraftCardProps {
  draft: ReviewDraft;
  context: 'roost' | 'meeting';
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  coops: CoopSharedState[];
}

export function DraftCard({
  draft,
  draftEditor,
  inferenceState,
  runtimeConfig,
  coops,
}: DraftCardProps) {
  const value = draftEditor.draftValue(draft);

  return (
    <article className="draft-card stack" key={draft.id}>
      <div className="badge-row">
        <span className="badge">
          {value.workflowStage === 'ready' ? 'ready to share' : 'hatching'}
        </span>
        <span className="badge">{value.category}</span>
        {value.provenance.type === 'receiver' ? <span className="badge">pocket coop</span> : null}
        {isArchiveWorthy(value) ? <span className="badge">worth saving</span> : null}
      </div>
      <div className="field-grid">
        <label htmlFor={`title-${draft.id}`}>Title</label>
        <input
          id={`title-${draft.id}`}
          onChange={(event) => draftEditor.updateDraft(draft, { title: event.target.value })}
          value={value.title}
        />
      </div>
      <div className="field-grid">
        <label htmlFor={`summary-${draft.id}`}>Summary</label>
        <textarea
          id={`summary-${draft.id}`}
          onChange={(event) => draftEditor.updateDraft(draft, { summary: event.target.value })}
          value={value.summary}
        />
      </div>
      <div className="detail-grid">
        <div className="field-grid">
          <label htmlFor={`category-${draft.id}`}>Category</label>
          <select
            id={`category-${draft.id}`}
            onChange={(event) =>
              draftEditor.updateDraft(draft, {
                category: event.target.value as ReviewDraft['category'],
              })
            }
            value={value.category}
          >
            {artifactCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="field-grid">
          <label htmlFor={`tags-${draft.id}`}>Tags</label>
          <input
            id={`tags-${draft.id}`}
            onChange={(event) =>
              draftEditor.updateDraft(draft, {
                tags: event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            value={value.tags.join(', ')}
          />
        </div>
      </div>
      <div className="field-grid">
        <label htmlFor={`why-${draft.id}`}>Why it matters</label>
        <textarea
          id={`why-${draft.id}`}
          onChange={(event) => draftEditor.updateDraft(draft, { whyItMatters: event.target.value })}
          value={value.whyItMatters}
        />
      </div>
      <div className="field-grid">
        <label htmlFor={`next-step-${draft.id}`}>Suggested next step</label>
        <textarea
          id={`next-step-${draft.id}`}
          onChange={(event) =>
            draftEditor.updateDraft(draft, { suggestedNextStep: event.target.value })
          }
          value={value.suggestedNextStep}
        />
      </div>
      <div className="field-grid">
        <span className="helper-text">Share with coop(s)</span>
        <div className="badge-row">
          {coops.map((coop) => {
            const selected = value.suggestedTargetCoopIds.includes(coop.profile.id);
            return (
              <button
                className={selected ? 'inline-button' : 'secondary-button'}
                key={coop.profile.id}
                onClick={() => draftEditor.toggleDraftTargetCoop(draft, coop.profile.id)}
                type="button"
              >
                {selected ? 'Included' : 'Add'} {coop.profile.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="helper-text">{value.rationale}</div>
      {isArchiveWorthy(value) ? (
        <div className="helper-text">
          This draft is marked worth saving once the summary feels clean.
        </div>
      ) : null}
      {draftEditor.refineResults[draft.id] ? (
        <div
          className="panel-card"
          style={{ background: 'var(--surface-alt, #f0f0f0)', padding: '0.5rem' }}
        >
          <strong>Polish suggestion</strong>
          <span className="badge">{draftEditor.refineResults[draft.id].provider}</span>
          {draftEditor.refineResults[draft.id].refinedTitle ? (
            <div className="field-grid">
              <span className="helper-text">Title</span>
              <span>{draftEditor.refineResults[draft.id].refinedTitle}</span>
            </div>
          ) : null}
          {draftEditor.refineResults[draft.id].refinedSummary ? (
            <div className="field-grid">
              <span className="helper-text">Summary</span>
              <span>{draftEditor.refineResults[draft.id].refinedSummary}</span>
            </div>
          ) : null}
          {draftEditor.refineResults[draft.id].suggestedTags ? (
            <div className="field-grid">
              <span className="helper-text">Tags</span>
              <span>{draftEditor.refineResults[draft.id].suggestedTags?.join(', ')}</span>
            </div>
          ) : null}
          <div className="action-row">
            <button
              className="primary-button"
              onClick={() => draftEditor.applyRefineResult(draft)}
              type="button"
            >
              Apply
            </button>
            <button
              className="secondary-button"
              onClick={() => draftEditor.dismissRefineResult(draft.id)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="action-row">
        {inferenceState?.capability.status !== 'disabled' ? (
          <button
            className="secondary-button"
            disabled={draftEditor.refiningDrafts.has(draft.id)}
            onClick={() => void draftEditor.refineDraft(draft, 'summary-compression')}
            type="button"
          >
            {draftEditor.refiningDrafts.has(draft.id) ? 'Polishing...' : 'Polish locally'}
          </button>
        ) : null}
        <button
          className="secondary-button"
          onClick={() => void draftEditor.saveDraft(draft)}
          type="button"
        >
          Save to roost
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.toggleDraftArchiveWorthiness(draft)}
          type="button"
        >
          {isArchiveWorthy(value) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        {value.workflowStage === 'candidate' ? (
          <button
            className="secondary-button"
            onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'ready')}
            type="button"
          >
            Ready to share
          </button>
        ) : (
          <button
            className="secondary-button"
            onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'candidate')}
            type="button"
          >
            Send back to hatching
          </button>
        )}
        {runtimeConfig?.privacyMode === 'on' && value.workflowStage === 'ready' ? (
          <label className="field-row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draftEditor.anonymousPublish}
              onChange={(e) => draftEditor.setAnonymousPublish(e.target.checked)}
            />
            <span className="label-quiet">Publish anonymously</span>
            <span className="hint" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              Hide author name, prove membership with ZK
            </span>
          </label>
        ) : null}
        {value.workflowStage === 'ready' ? (
          <button
            className="primary-button"
            onClick={() => void draftEditor.publishDraft(draft)}
            type="button"
          >
            Share with coop
          </button>
        ) : null}
        <a
          className="secondary-button"
          href={value.sources[0]?.url}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ReceiverIntakeCard
// ---------------------------------------------------------------------------

export interface ReceiverIntakeCardProps {
  capture: ReceiverCapture;
  draftEditor: DraftEditorReturn;
}

export function ReceiverIntakeCard({ capture, draftEditor }: ReceiverIntakeCardProps) {
  return (
    <article className="draft-card stack" key={capture.id}>
      <strong>{capture.title}</strong>
      <div className="badge-row">
        <span className="badge">{capture.kind}</span>
        <span className="badge">{capture.syncState}</span>
        <span className="badge">{capture.intakeStatus}</span>
        {isArchiveWorthy(capture) ? <span className="badge">worth saving</span> : null}
      </div>
      <div className="helper-text">
        {capture.memberDisplayName ?? 'Unknown member'} ·{' '}
        {new Date(capture.syncedAt ?? capture.createdAt).toLocaleString()}
      </div>
      <div className="helper-text">
        {capture.fileName ?? `${capture.byteSize} bytes`} · {capture.mimeType}
      </div>
      {capture.sourceUrl ? (
        <div className="helper-text">
          <a className="source-link" href={capture.sourceUrl} rel="noreferrer" target="_blank">
            {capture.sourceUrl}
          </a>
        </div>
      ) : null}
      {capture.syncError ? <div className="helper-text">{capture.syncError}</div> : null}
      <div className="action-row">
        <button
          className="secondary-button"
          onClick={() => void draftEditor.toggleReceiverCaptureArchiveWorthiness(capture)}
          type="button"
        >
          {isArchiveWorthy(capture) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.convertReceiverCapture(capture, 'candidate')}
          type="button"
        >
          Move to hatching
        </button>
        <button
          className="primary-button"
          onClick={() => void draftEditor.convertReceiverCapture(capture, 'ready')}
          type="button"
        >
          Make a draft
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.archiveReceiverCapture(capture.id)}
          type="button"
        >
          Save locally
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ArtifactCard
// ---------------------------------------------------------------------------

export interface ArtifactCardProps {
  artifact: CoopSharedState['artifacts'][number];
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  activeCoop: CoopSharedState | undefined;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
}

export function ArtifactCard({
  artifact,
  archiveReceipts,
  activeCoop,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
}: ArtifactCardProps) {
  const latestReceipt =
    [...archiveReceipts].find((receipt) =>
      activeCoop?.artifacts
        .find((candidate) => candidate.id === artifact.id)
        ?.archiveReceiptIds.includes(receipt.id),
    ) ?? null;

  return (
    <article className="artifact-card stack" key={artifact.id}>
      <strong>{artifact.title}</strong>
      <div className="badge-row">
        <span className="badge">{formatArtifactCategoryLabel(artifact.category)}</span>
        <span className="badge">{formatReviewStatusLabel(artifact.reviewStatus)}</span>
        <span className="badge">{formatSaveStatusLabel(artifact.archiveStatus)}</span>
        {isArchiveWorthy(artifact) ? <span className="badge">worth saving</span> : null}
        {artifact.createdBy === 'anonymous-member' ? (
          <span className="badge" style={{ background: 'var(--accent-subtle, #2d2d3d)' }}>
            anonymous {artifact.membershipProof ? '(ZK verified)' : ''}
          </span>
        ) : null}
        {artifact.createdBy === 'unverified-anonymous' ? (
          <span className="badge" style={{ background: 'var(--warning, #8b6914)' }}>
            unverified anonymous
          </span>
        ) : null}
      </div>
      <div className="helper-text">{artifact.summary}</div>
      <div className="helper-text">{artifact.whyItMatters}</div>
      {latestReceipt ? (
        <div className="helper-text">
          Saved already ·{' '}
          <a
            className="source-link"
            href={latestReceipt.gatewayUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open saved proof
          </a>
        </div>
      ) : null}
      <div className="action-row">
        <button
          className="secondary-button"
          onClick={() =>
            void toggleArtifactArchiveWorthiness(artifact.id, !isArchiveWorthy(artifact))
          }
          type="button"
        >
          {isArchiveWorthy(artifact) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        <button
          className="primary-button"
          onClick={() => void archiveArtifact(artifact.id)}
          type="button"
        >
          Save this find
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// ArchiveReceiptCard
// ---------------------------------------------------------------------------

export interface ArchiveReceiptCardProps {
  receipt: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  liveArchiveAvailable: boolean;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  onAnchorOnChain: (receiptId: string) => void;
  onFvmRegister?: (receiptId: string) => void;
}

const FILECOIN_LIFECYCLE_STEPS = ['pending', 'offered', 'indexed', 'sealed'] as const;

function FilecoinLifecycleBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: 'Uploaded',
    offered: 'Offered',
    indexed: 'Indexed',
    sealed: 'Sealed',
  };
  return (
    <div className="badge-row" style={{ gap: '0.25rem' }}>
      {FILECOIN_LIFECYCLE_STEPS.map((step) => {
        const isActive =
          FILECOIN_LIFECYCLE_STEPS.indexOf(step) <=
          FILECOIN_LIFECYCLE_STEPS.indexOf(status as (typeof FILECOIN_LIFECYCLE_STEPS)[number]);
        return (
          <span
            key={step}
            className="badge"
            style={{
              opacity: isActive ? 1 : 0.4,
              fontWeight: step === status ? 'bold' : 'normal',
            }}
          >
            {labels[step] ?? step}
          </span>
        );
      })}
    </div>
  );
}

export function ArchiveReceiptCard({
  receipt,
  runtimeConfig,
  liveArchiveAvailable,
  refreshArchiveStatus,
  onAnchorOnChain,
  onFvmRegister,
}: ArchiveReceiptCardProps) {
  return (
    <article className="draft-card stack" key={receipt.id}>
      <div className="badge-row">
        <span className="badge">{formatSavedProofScope(receipt.scope)}</span>
        <span className="badge">{formatSavedProofMode(receipt.delegationMode)}</span>
      </div>
      <FilecoinLifecycleBadge status={receipt.filecoinStatus} />
      <strong>{receipt.title}</strong>
      <div className="helper-text">{receipt.purpose}</div>
      <div className="helper-text">{receipt.summary}</div>
      <div className="detail-grid archive-detail-grid">
        <div>
          <strong>Open saved bundle</strong>
          <div className="helper-text">
            <a className="source-link" href={receipt.gatewayUrl} rel="noreferrer" target="_blank">
              {receipt.gatewayUrl}
            </a>
          </div>
        </div>
        <div>
          <strong>Save ID</strong>
          <div className="helper-text">{receipt.rootCid}</div>
        </div>
        <div>
          <strong>Saved</strong>
          <div className="helper-text">{new Date(receipt.uploadedAt).toLocaleString()}</div>
        </div>
        <div>
          <strong>Items saved</strong>
          <div className="helper-text">{receipt.itemCount} item(s)</div>
        </div>
        <div>
          <strong>Storage piece</strong>
          <div className="helper-text" title={receipt.primaryPieceCid ?? undefined}>
            {receipt.primaryPieceCid ? truncateCid(receipt.primaryPieceCid) : 'Not reported yet'}
          </div>
        </div>
        <div>
          <strong>Save source</strong>
          <div className="helper-text">{receipt.delegationSource ?? receipt.delegationIssuer}</div>
        </div>
        <div>
          <strong>Deep-save check</strong>
          <div className="helper-text">
            {receipt.dealCount > 0
              ? `${receipt.dealCount} deal(s) tracked`
              : receipt.aggregateCount > 0
                ? `${receipt.aggregateCount} aggregate(s) tracked`
                : 'No deep-save data yet'}
          </div>
        </div>
      </div>
      {receipt.filecoinDeals.length > 0 ? (
        <div>
          <strong>Filecoin deals</strong>
          {receipt.filecoinDeals.map((deal, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: deals have no stable unique key beyond index
            <div className="helper-text" key={i} style={{ marginLeft: '0.5rem' }}>
              {deal.provider ? (
                <a
                  className="source-link"
                  href={getFilfoxProviderUrl(deal.provider)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {deal.provider}
                </a>
              ) : (
                <span>No provider yet</span>
              )}
              {deal.dealId ? (
                <>
                  {' '}
                  <a
                    className="source-link"
                    href={getFilfoxDealUrl(deal.dealId)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Deal #{deal.dealId}
                  </a>
                </>
              ) : null}
              <span title={deal.aggregate}> ({truncateCid(deal.aggregate)})</span>
              <span className="badge" style={{ marginLeft: '0.25rem' }}>
                Sealed
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {receipt.filecoinAggregates.length > 0 ? (
        <div>
          <strong>Aggregates</strong>
          {receipt.filecoinAggregates.map((agg, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: aggregates have no stable unique key beyond index
            <div className="helper-text" key={i} style={{ marginLeft: '0.5rem' }}>
              <span title={agg.aggregate}>{truncateCid(agg.aggregate)}</span>
              <span className="badge" style={{ marginLeft: '0.25rem' }}>
                {agg.inclusionProofAvailable ? 'Proof available' : 'Proof pending'}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="helper-text">
        {receipt.lastRefreshedAt
          ? `Last deep-save check ${new Date(receipt.lastRefreshedAt).toLocaleString()}`
          : 'No deep-save check yet.'}
      </div>
      {receipt.filecoinInfoLastUpdatedAt ? (
        <div className="helper-text">
          Filecoin info updated {new Date(receipt.filecoinInfoLastUpdatedAt).toLocaleString()}
        </div>
      ) : null}
      {receipt.lastRefreshError ? (
        <div className="helper-text">
          Latest deep-save check had trouble: {receipt.lastRefreshError}
        </div>
      ) : null}
      {receipt.delegationMode === 'live' && receipt.filecoinStatus !== 'sealed' ? (
        <div className="action-row">
          <button
            className="secondary-button"
            disabled={!liveArchiveAvailable}
            onClick={() => void refreshArchiveStatus(receipt.id)}
            type="button"
          >
            Refresh deep-save check
          </button>
        </div>
      ) : null}
      {receipt.anchorTxHash ? (
        <a
          className="badge anchor-badge source-link"
          href={getAnchorExplorerUrl(receipt.anchorTxHash, receipt.anchorChainKey ?? 'sepolia')}
          rel="noreferrer"
          target="_blank"
        >
          Anchored ({receipt.anchorChainKey ?? 'unknown chain'})
        </a>
      ) : receipt.delegationMode === 'live' &&
        !receipt.anchorTxHash &&
        runtimeConfig.onchainMode === 'live' ? (
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() => onAnchorOnChain(receipt.id)}
            type="button"
          >
            Anchor on-chain
          </button>
        </div>
      ) : null}
      {receipt.fvmRegistryTxHash ? (
        <a
          className="badge anchor-badge source-link"
          href={getFvmExplorerTxUrl(
            receipt.fvmRegistryTxHash,
            receipt.fvmChainKey ?? 'filecoin-calibration',
          )}
          rel="noreferrer"
          target="_blank"
        >
          Registered on Filecoin ({receipt.fvmChainKey === 'filecoin' ? 'mainnet' : 'calibration'})
        </a>
      ) : onFvmRegister && receipt.delegationMode === 'live' && !receipt.fvmRegistryTxHash ? (
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() => onFvmRegister(receipt.id)}
            type="button"
          >
            Register on Filecoin
          </button>
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCards
// ---------------------------------------------------------------------------

export interface SkeletonCardsProps {
  count: number;
  label: string;
}

export function SkeletonCards({ count, label }: SkeletonCardsProps) {
  return (
    <output aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have stable count and no identity
        <div className="skeleton skeleton-card" aria-hidden="true" key={i} />
      ))}
    </output>
  );
}

// ---------------------------------------------------------------------------
// SkeletonSummary
// ---------------------------------------------------------------------------

export interface SkeletonSummaryProps {
  label: string;
}

export function SkeletonSummary({ label }: SkeletonSummaryProps) {
  return (
    <output aria-label={label}>
      <div className="summary-strip">
        <div className="skeleton skeleton-summary" aria-hidden="true" />
        <div className="skeleton skeleton-summary" aria-hidden="true" />
        <div className="skeleton skeleton-summary" aria-hidden="true" />
      </div>
      <div className="skeleton skeleton-header" aria-hidden="true" />
      <div className="skeleton skeleton-card" aria-hidden="true" />
      <div className="skeleton skeleton-card" aria-hidden="true" />
    </output>
  );
}
