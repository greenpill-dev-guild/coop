import type {
  CaptureMode,
  CoopSoul,
  CoopSpaceType,
  RitualDefinition,
} from '../../contracts/schema';
import { compactWhitespace, truncateWords, unique } from '../../utils';

export interface SynthesizeCoopFromPurposeInput {
  coopName: string;
  purpose: string;
  spaceType?: CoopSpaceType;
  captureMode: CaptureMode;
}

interface FocusRule {
  label: string;
  keywords: string[];
  ritualMoment: string;
}

const focusRules: FocusRule[] = [
  {
    label: 'funding leads',
    keywords: ['fund', 'grant', 'budget', 'resource', 'capital', 'finance', 'donation', 'sponsor'],
    ritualMoment: 'Funding scan',
  },
  {
    label: 'evidence',
    keywords: ['evidence', 'impact', 'metric', 'metrics', 'proof', 'report', 'outcome'],
    ritualMoment: 'Proof round-up',
  },
  {
    label: 'next steps',
    keywords: [
      'action',
      'actions',
      'next step',
      'follow-up',
      'follow up',
      'decision',
      'decisions',
      'plan',
      'plans',
      'task',
      'tasks',
      'coordination',
    ],
    ritualMoment: 'Action sorting',
  },
  {
    label: 'research notes',
    keywords: [
      'research',
      'note',
      'notes',
      'knowledge',
      'context',
      'doc',
      'docs',
      'reference',
      'references',
      'learning',
      'study',
      'tab',
      'tabs',
    ],
    ritualMoment: 'Research harvest',
  },
  {
    label: 'member signals',
    keywords: [
      'member',
      'community',
      'people',
      'family',
      'friend',
      'friends',
      'household',
      'care',
      'support',
      'volunteer',
      'participant',
    ],
    ritualMoment: 'Member pulse',
  },
];

const fallbackArtifactFocusByType: Record<CoopSpaceType, string[]> = {
  community: ['research notes', 'funding leads', 'evidence', 'next steps'],
  project: ['decision logs', 'research notes', 'next steps'],
  friends: ['plans', 'recommendations', 'next steps'],
  family: ['household notes', 'care reminders', 'next steps'],
  personal: ['research notes', 'ideas', 'next steps'],
};

const baseToneByType: Record<CoopSpaceType, string> = {
  community: 'Warm, observant, and practical in shared follow-through.',
  project: 'Direct, calm, and delivery-minded.',
  friends: 'Lightweight, warm, and clear enough that plans stay alive.',
  family: 'Gentle, practical, and easy for the household to follow.',
  personal: 'Reflective, lightweight, and honest about what matters now.',
};

const reviewMomentByType: Record<CoopSpaceType, (coopName: string) => string> = {
  community: (coopName) => `${coopName} review circle`,
  project: (coopName) => `${coopName} working review`,
  friends: (coopName) => `${coopName} check-in`,
  family: (coopName) => `${coopName} family review`,
  personal: (coopName) => `${coopName} self-review`,
};

function clean(value: string) {
  return compactWhitespace(value.trim());
}

function lowercaseFirst(value: string) {
  if (!value) {
    return value;
  }
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.!?]+$/g, '').trim();
}

function formatList(values: string[]) {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return values[0] ?? '';
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  const leading = values.slice(0, -1).join(', ');
  return `${leading}, and ${values.at(-1)}`;
}

function toPurposeClause(purpose: string) {
  const sentence = clean(purpose).split(/(?<=[.!?])\s+/u)[0] ?? purpose;
  return stripTrailingPunctuation(sentence);
}

function toExistenceStatement(coopName: string, purpose: string) {
  const trimmedCoopName = clean(coopName) || 'This coop';
  const clause = toPurposeClause(purpose);
  if (!clause) {
    return `${trimmedCoopName} exists to keep useful context visible and actionable.`;
  }
  if (/^(a|an|the)\b/i.test(clause)) {
    return `${trimmedCoopName} exists as ${lowercaseFirst(clause)}.`;
  }
  if (/^to\b/i.test(clause)) {
    return `${trimmedCoopName} exists ${lowercaseFirst(clause)}.`;
  }
  return `${trimmedCoopName} exists to ${lowercaseFirst(clause)}.`;
}

function deriveArtifactFocus(purpose: string, spaceType: CoopSpaceType) {
  const normalizedPurpose = clean(purpose).toLowerCase();
  const matchedFocus = focusRules
    .map((rule) => {
      const indices = rule.keywords
        .map((keyword) => normalizedPurpose.indexOf(keyword))
        .filter((index) => index >= 0);
      if (indices.length === 0) {
        return null;
      }
      return {
        label: rule.label,
        firstIndex: Math.min(...indices),
      };
    })
    .filter((value): value is { label: string; firstIndex: number } => value !== null)
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map((value) => value.label);

  return unique([...matchedFocus, ...fallbackArtifactFocusByType[spaceType]]).slice(0, 4);
}

function buildToneAndWorkingStyle(spaceType: CoopSpaceType, purpose: string) {
  const normalizedPurpose = clean(purpose).toLowerCase();
  const refinements: string[] = [];

  if (/(evidence|impact|metric|proof|report|outcome)/.test(normalizedPurpose)) {
    refinements.push('Stay evidence-first when deciding what to keep.');
  }
  if (/(fund|grant|budget|resource|capital|finance|donation|sponsor)/.test(normalizedPurpose)) {
    refinements.push('Notice concrete opportunities before they disappear.');
  }
  if (
    refinements.length === 0 &&
    /(action|next step|follow-up|follow up|decision|decisions|plan|plans|task|tasks)/.test(
      normalizedPurpose,
    )
  ) {
    refinements.push('Prefer concrete follow-through over vague backlog.');
  }

  return [baseToneByType[spaceType], ...refinements].join(' ').trim();
}

function buildUsefulSignalDefinition(artifactFocus: string[]) {
  const focusText = formatList(artifactFocus.slice(0, 3));
  return `Useful signals are tabs, notes, and artifacts that sharpen ${focusText} and turn them into clear next steps.`;
}

function buildFacilitatorExpectation(spaceType: CoopSpaceType, artifactFocus: string[]) {
  const focusText = formatList(artifactFocus.slice(0, 2));
  switch (spaceType) {
    case 'project':
      return `A project lead or trusted operator keeps ${focusText} actionable so blockers, owners, and next steps stay explicit.`;
    case 'friends':
      return `One friend lightly steers ${focusText} so plans and recommendations do not drift away.`;
    case 'family':
      return `A household organizer keeps ${focusText} legible so care, scheduling, and follow-through stay shared.`;
    case 'personal':
      return `You review ${focusText} and decide what stays private, what becomes a next step, and what is ready to archive.`;
    case 'community':
    default:
      return `A trusted member steers ${focusText} into shared context, visible opportunities, and clear next steps.`;
  }
}

function buildNamedMoments(
  coopName: string,
  artifactFocus: string[],
  spaceType: CoopSpaceType,
  captureMode: CaptureMode,
) {
  const primaryFocus = artifactFocus[0];
  const primaryMoment =
    focusRules.find((rule) => rule.label === primaryFocus)?.ritualMoment ?? 'Signal harvest';
  const reviewMoment = reviewMomentByType[spaceType](clean(coopName) || 'Coop');
  const captureMoment = captureMode === 'manual' ? 'Manual round-up' : 'Draft triage';
  return unique([primaryMoment, reviewMoment, captureMoment]);
}

function buildDefaultCapturePosture(captureMode: CaptureMode, artifactFocus: string[]) {
  const primaryFocus = artifactFocus[0] ?? 'useful context';
  if (captureMode === 'manual') {
    return `Manual round-up is primary. Save ${primaryFocus} when it sharpens a decision, pattern, or next step.`;
  }
  return `Scheduled scans can draft ${primaryFocus}, but members still decide what enters shared memory.`;
}

function buildWeeklyReviewCadence(spaceType: CoopSpaceType) {
  switch (spaceType) {
    case 'project':
      return 'Weekly working review';
    case 'friends':
      return 'Weekly check-in';
    case 'family':
      return 'Weekly family check-in';
    case 'personal':
      return 'Weekly self-review';
    case 'community':
    default:
      return 'Weekly review circle';
  }
}

export function createDefaultSeedContribution(coopName: string) {
  const trimmedName = clean(coopName) || 'this coop';
  return `I want ${trimmedName} to keep useful context, loose research, and next steps visible.`;
}

export function summarizeSoulArtifact(soul: CoopSoul) {
  return truncateWords(`${soul.whyThisCoopExists} ${soul.usefulSignalDefinition}`, 28);
}

export function summarizeRitualArtifact(ritual: RitualDefinition) {
  return truncateWords(
    `${ritual.weeklyReviewCadence} centers ${formatList(ritual.namedMoments.slice(0, 2))}.`,
    28,
  );
}

export interface SynthesizeTranscriptsInput {
  capital: string;
  impact: string;
  governance: string;
  knowledge: string;
}

/**
 * Combines the four ritual-lens transcripts into a single purpose paragraph
 * suitable for pasting into the coop purpose field.
 */
export function synthesizeTranscriptsToPurpose(input: SynthesizeTranscriptsInput): string {
  const parts: string[] = [];

  const knowledge = clean(input.knowledge);
  const capital = clean(input.capital);
  const governance = clean(input.governance);
  const impact = clean(input.impact);

  if (knowledge) {
    parts.push(`keep ${truncateWords(knowledge, 18)} visible`);
  }
  if (capital) {
    parts.push(`track ${truncateWords(capital, 18)}`);
  }
  if (governance) {
    parts.push(`coordinate ${truncateWords(governance, 18)}`);
  }
  if (impact) {
    parts.push(`measure ${truncateWords(impact, 18)}`);
  }

  if (parts.length === 0) {
    return '';
  }

  const joined = formatList(parts);
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} — so nothing useful gets lost.`;
}

export function synthesizeCoopFromPurpose(input: SynthesizeCoopFromPurposeInput): {
  soul: CoopSoul;
  rituals: RitualDefinition[];
} {
  const spaceType = input.spaceType ?? 'community';
  const purpose =
    clean(input.purpose) || 'Keep useful context visible, legible, and actionable together.';
  const artifactFocus = deriveArtifactFocus(purpose, spaceType);

  return {
    soul: {
      purposeStatement: purpose,
      toneAndWorkingStyle: buildToneAndWorkingStyle(spaceType, purpose),
      usefulSignalDefinition: buildUsefulSignalDefinition(artifactFocus),
      artifactFocus,
      whyThisCoopExists: toExistenceStatement(input.coopName, purpose),
      vocabularyTerms: [],
      prohibitedTopics: [],
      confidenceThreshold: 0.72,
    },
    rituals: [
      {
        weeklyReviewCadence: buildWeeklyReviewCadence(spaceType),
        namedMoments: buildNamedMoments(
          input.coopName,
          artifactFocus,
          spaceType,
          input.captureMode,
        ),
        facilitatorExpectation: buildFacilitatorExpectation(spaceType, artifactFocus),
        defaultCapturePosture: buildDefaultCapturePosture(input.captureMode, artifactFocus),
      },
    ],
  };
}
