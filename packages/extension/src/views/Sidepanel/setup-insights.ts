import type { CaptureMode, CoopSpaceType, SetupInsights } from '@coop/shared';

export interface CreateFormState {
  coopName: string;
  purpose: string;
  spaceType: CoopSpaceType;
  creatorDisplayName: string;
  seedContribution: string;
  captureMode: CaptureMode;
  createGreenGoodsGarden: boolean;
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
  archiveSpaceDid: string;
  archiveAgentPrivateKey: string;
  archiveSpaceDelegation: string;
  archiveGatewayUrl: string;
}

export const initialCreateForm: CreateFormState = {
  coopName: '',
  purpose: '',
  spaceType: 'community',
  creatorDisplayName: '',
  seedContribution: '',
  captureMode: 'manual',
  createGreenGoodsGarden: false,
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
  archiveSpaceDid: '',
  archiveAgentPrivateKey: '',
  archiveSpaceDelegation: '',
  archiveGatewayUrl: '',
};

export function hasArchiveConfig(form: CreateFormState): boolean {
  return form.archiveSpaceDid.trim().length > 0 && form.archiveSpaceDelegation.trim().length > 0;
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function defaultSetupSummary(form: CreateFormState) {
  const coopName = clean(form.coopName) || 'This coop';
  return `${coopName} uses Coop to keep useful tabs, notes, and next steps from getting loose.`;
}

function buildLensValue(value: string, fallback: string) {
  return clean(value) || fallback;
}

export function toSetupInsights(form: CreateFormState): SetupInsights {
  const coopLabel = clean(form.coopName) || 'this coop';

  return {
    summary: clean(form.summary) || defaultSetupSummary(form),
    crossCuttingPainPoints: [
      clean(form.capitalPain),
      clean(form.impactPain),
      clean(form.governancePain),
      clean(form.knowledgePain),
    ]
      .filter(Boolean)
      .slice(0, 4),
    crossCuttingOpportunities: [
      clean(form.capitalImprove),
      clean(form.impactImprove),
      clean(form.governanceImprove),
      clean(form.knowledgeImprove),
    ]
      .filter(Boolean)
      .slice(0, 4),
    lenses: [
      {
        lens: 'capital-formation',
        currentState: buildLensValue(
          form.capitalCurrent,
          `Money and resource context for ${coopLabel} is currently scattered across tabs, notes, and messages.`,
        ),
        painPoints: buildLensValue(
          form.capitalPain,
          'Good opportunities are easy to miss before the flock can review them together.',
        ),
        improvements: buildLensValue(
          form.capitalImprove,
          'Keep promising opportunities visible in one roost and turn them into shared next steps.',
        ),
      },
      {
        lens: 'impact-reporting',
        currentState: buildLensValue(
          form.impactCurrent,
          `Evidence and progress for ${coopLabel} are gathered in different places and often too late.`,
        ),
        painPoints: buildLensValue(
          form.impactPain,
          'Useful proof gets buried before anyone can connect it to the right moment.',
        ),
        improvements: buildLensValue(
          form.impactImprove,
          'Keep proof close to the work so the coop can notice progress earlier.',
        ),
      },
      {
        lens: 'governance-coordination',
        currentState: buildLensValue(
          form.governanceCurrent,
          `Decisions and follow-through for ${coopLabel} mostly live in meetings, memory, and chat.`,
        ),
        painPoints: buildLensValue(
          form.governancePain,
          'Follow-up slips when nobody can quickly see what was noticed, promised, or still open.',
        ),
        improvements: buildLensValue(
          form.governanceImprove,
          'Give the flock one clear review loop for decisions, commitments, and next steps.',
        ),
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: buildLensValue(
          form.knowledgeCurrent,
          `Useful links and notes for ${coopLabel} are spread across browsers, devices, and people.`,
        ),
        painPoints: buildLensValue(
          form.knowledgePain,
          'People repeat the same research because the best finds do not stay visible.',
        ),
        improvements: buildLensValue(
          form.knowledgeImprove,
          'Catch loose knowledge early and keep the strongest finds easy to revisit.',
        ),
      },
    ],
  };
}
