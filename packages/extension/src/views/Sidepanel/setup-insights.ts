import type { CaptureMode, SetupInsights } from '@coop/shared';

export interface CreateFormState {
  coopName: string;
  purpose: string;
  creatorDisplayName: string;
  seedContribution: string;
  captureMode: CaptureMode;
  summary: string;
  capitalCurrent: string;
  capitalPain: string;
  capitalImprove: string;
  impactCurrent: string;
  impactPain: string;
  impactImprove: string;
  governanceCurrent: string;
  governancePain: string;
  governanceImprove: string;
  knowledgeCurrent: string;
  knowledgePain: string;
  knowledgeImprove: string;
}

export const initialCreateForm: CreateFormState = {
  coopName: '',
  purpose: '',
  creatorDisplayName: '',
  seedContribution: '',
  captureMode: 'manual',
  summary: '',
  capitalCurrent: '',
  capitalPain: '',
  capitalImprove: '',
  impactCurrent: '',
  impactPain: '',
  impactImprove: '',
  governanceCurrent: '',
  governancePain: '',
  governanceImprove: '',
  knowledgeCurrent: '',
  knowledgePain: '',
  knowledgeImprove: '',
};

export function toSetupInsights(form: CreateFormState): SetupInsights {
  return {
    summary: form.summary,
    crossCuttingPainPoints: [
      form.capitalPain,
      form.impactPain,
      form.governancePain,
      form.knowledgePain,
    ]
      .filter(Boolean)
      .slice(0, 4),
    crossCuttingOpportunities: [
      form.capitalImprove,
      form.impactImprove,
      form.governanceImprove,
      form.knowledgeImprove,
    ]
      .filter(Boolean)
      .slice(0, 4),
    lenses: [
      {
        lens: 'capital-formation',
        currentState: form.capitalCurrent,
        painPoints: form.capitalPain,
        improvements: form.capitalImprove,
      },
      {
        lens: 'impact-reporting',
        currentState: form.impactCurrent,
        painPoints: form.impactPain,
        improvements: form.impactImprove,
      },
      {
        lens: 'governance-coordination',
        currentState: form.governanceCurrent,
        painPoints: form.governancePain,
        improvements: form.governanceImprove,
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: form.knowledgeCurrent,
        painPoints: form.knowledgePain,
        improvements: form.knowledgeImprove,
      },
    ],
  };
}
