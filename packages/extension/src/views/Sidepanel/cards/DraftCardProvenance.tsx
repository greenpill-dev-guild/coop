import { ConfidenceTooltip } from '../../shared/ConfidenceTooltip';
import { type Precedent, PrecedentIndicator } from '../../shared/PrecedentIndicator';
import { SourceBadge } from '../../shared/SourceBadge';
import { formatSourceRef } from './card-shared';

export interface DraftCardProvenanceProps {
  provenanceType: string;
  sourceRefs?: string[];
  contextLabels?: string[];
  precedent?: Precedent | null;
  confidence: number;
  confidenceAdjustment?: number;
}

export function DraftCardProvenance({
  provenanceType,
  sourceRefs,
  contextLabels,
  precedent,
  confidence,
  confidenceAdjustment = 0,
}: DraftCardProvenanceProps) {
  const isAgent = provenanceType === 'agent';
  const hasSourceRefs = sourceRefs && sourceRefs.length > 0;

  if (!isAgent || !hasSourceRefs) return null;

  const confidencePct = Math.round(confidence * 100);

  return (
    <div className="draft-card__provenance">
      <span className="draft-card__section-label">Sourced from</span>
      <div className="badge-row">
        {sourceRefs.slice(0, 3).map((ref) => {
          const parsed = formatSourceRef(ref);
          return parsed ? <SourceBadge key={ref} type={parsed.type} name={parsed.name} /> : null;
        })}
        {(contextLabels && contextLabels.length > 0 ? contextLabels : ['observed/unconfirmed'])
          .slice(0, 2)
          .map((label) => (
            <span className="state-pill" key={label}>
              {label}
            </span>
          ))}
      </div>
      <PrecedentIndicator precedent={precedent ?? null} />
      <ConfidenceTooltip
        confidence={confidencePct}
        breakdown={{
          schema: Math.round(confidence * 50),
          content: Math.round(confidence * 40),
          precedentDelta: Math.round(confidenceAdjustment * 100),
        }}
      />
    </div>
  );
}
