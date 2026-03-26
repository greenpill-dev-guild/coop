import type { CoopSpaceType, SetupInsightsInput } from '@coop/shared';
import { emptySetupInsightsInput, toSetupInsights } from '@coop/shared';
import type {
  AudienceId,
  AudienceOption,
  JourneyChicken,
  LandingDraft,
  LandingPacketOptions,
  LensProgress,
  LensStatus,
  RitualCardMapping,
  SetupFieldKey,
  SpeechWindow,
  StoryCard,
  TranscriptKey,
  TranscriptMap,
} from './landing-types';

export const LANDING_DRAFT_STORAGE_KEY = 'coop-landing-ritual-v2';

export const defaultTranscriptStatus =
  'Use live transcript if this browser supports it, or type directly into the card. Everything stays saved on this device.';

export const journeyChickens: JourneyChicken[] = [
  { id: 'tabs', label: 'Tabs', facing: 'right' },
  { id: 'notes', label: 'Notes', facing: 'right' },
  { id: 'ideas', label: 'Ideas', facing: 'left' },
  { id: 'signals', label: 'Signals', facing: 'left' },
  { id: 'links', label: 'Links', variant: 'young', facing: 'right' },
  { id: 'drafts', label: 'Drafts', variant: 'chick', facing: 'right' },
  { id: 'threads', label: 'Threads', variant: 'young', facing: 'left' },
  { id: 'clips', label: 'Clips', variant: 'chick', facing: 'left' },
];

export const audienceOptions: AudienceOption[] = [
  { id: 'persona', label: 'Personal', accent: 'Ember', tone: 'Personal focus and reflection' },
  { id: 'family', label: 'Family', accent: 'Meadow', tone: 'Household memory and support' },
  {
    id: 'friends',
    label: 'Friends',
    accent: 'Marigold',
    tone: 'Shared momentum with trusted peers',
  },
  {
    id: 'community',
    label: 'Community',
    accent: 'Canopy',
    tone: 'Collective coordination and stewardship',
  },
];

export const audienceToSpaceType: Record<AudienceId, CoopSpaceType> = {
  persona: 'personal',
  family: 'family',
  friends: 'friends',
  community: 'community',
};

export const ritualCardMappings: RitualCardMapping[] = [
  {
    id: 'knowledge',
    currentKey: 'knowledgeCurrent',
    painKey: 'knowledgePain',
    improveKey: 'knowledgeImprove',
  },
  {
    id: 'capital',
    currentKey: 'capitalCurrent',
    painKey: 'capitalPain',
    improveKey: 'capitalImprove',
  },
  {
    id: 'governance',
    currentKey: 'governanceCurrent',
    painKey: 'governancePain',
    improveKey: 'governanceImprove',
  },
  { id: 'impact', currentKey: 'impactCurrent', painKey: 'impactPain', improveKey: 'impactImprove' },
];

export const howItWorksCards: StoryCard[] = [
  {
    title: 'Your data stays yours',
    detail: 'Everything you capture stays on your device until your group decides what to share.',
  },
  {
    title: 'One place for everything',
    detail: 'Tabs, notes, files, and call fragments land together before they scatter.',
  },
  {
    title: 'Shared review loop',
    detail: 'One clear queue for the group instead of hunting across chats, browsers, and memory.',
  },
  {
    title: 'Proof that lasts',
    detail:
      'Progress and outcomes stay close to the work so updates are easier to revisit and trust.',
  },
];

export const teamMembers = ['Afolabi Aiyeloja', 'Luiz Fernando', 'Sofia Villareal'];
export const partnerMarks = [
  'Regen Coordination',
  'Greenpill',
  'Greenpill Dev Guild',
  'ReFi DAO',
  'Green Goods',
];

export const heroSignalFragments = [
  {
    id: 'call-clip',
    kicker: 'Call clip',
    text: 'Save the key moment before it drifts.',
    tone: 'ember',
    x: '62%',
    y: '17%',
    rotate: '-5deg',
    width: '10rem',
  },
  {
    id: 'browser-tab',
    kicker: 'Browser tab',
    text: 'This grant lead is worth the follow-up.',
    tone: 'meadow',
    x: '82%',
    y: '35%',
    rotate: '3deg',
    width: '11.5rem',
  },
  {
    id: 'field-note',
    kicker: 'Field note',
    text: 'Member energy is shifting this week.',
    tone: 'ink',
    x: '54%',
    y: '57%',
    rotate: '-2deg',
    width: '10.4rem',
  },
  {
    id: 'loose-thread',
    kicker: 'Loose thread',
    text: 'Remember to reconnect this after the meeting.',
    tone: 'ember',
    x: '78%',
    y: '77%',
    rotate: '4deg',
    width: '11rem',
  },
] as const;

// Chickens start scattered, then tighten into side-group activity without crossing the
// center reading lane. The motion should read as shared attention, not drift or collision
// with the hero and how-it-works content.
export const storyFlightPaths: Record<
  JourneyChicken['id'],
  Array<{ x: string; y: string; rotate: number; scale?: number }>
> = {
  tabs: [
    { x: '0.5vw', y: '0vh', rotate: -4, scale: 1.0 },
    { x: '2vw', y: '-0.5vh', rotate: 3, scale: 0.99 },
    { x: '3vw', y: '0.75vh', rotate: -2, scale: 0.985 },
    { x: '4vw', y: '0vh', rotate: 2, scale: 0.975 },
    { x: '4.5vw', y: '-1vh', rotate: 0, scale: 0.965 },
  ],
  notes: [
    { x: '0.5vw', y: '1vh', rotate: 4, scale: 1.0 },
    { x: '1.75vw', y: '2.4vh', rotate: -3, scale: 0.99 },
    { x: '2.75vw', y: '1.8vh', rotate: 2, scale: 0.985 },
    { x: '3.5vw', y: '3vh', rotate: -1, scale: 0.975 },
    { x: '4vw', y: '3.8vh', rotate: 0, scale: 0.965 },
  ],
  ideas: [
    { x: '-0.5vw', y: '1vh', rotate: -4, scale: 1.0 },
    { x: '-1.75vw', y: '2.4vh', rotate: 3, scale: 0.99 },
    { x: '-2.75vw', y: '1.8vh', rotate: -2, scale: 0.985 },
    { x: '-3.5vw', y: '3vh', rotate: 1, scale: 0.975 },
    { x: '-4vw', y: '3.8vh', rotate: 0, scale: 0.965 },
  ],
  signals: [
    { x: '-0.5vw', y: '0vh', rotate: 4, scale: 1.0 },
    { x: '-2vw', y: '-0.5vh', rotate: -3, scale: 0.99 },
    { x: '-3vw', y: '0.75vh', rotate: 2, scale: 0.985 },
    { x: '-4vw', y: '0vh', rotate: -1, scale: 0.975 },
    { x: '-4.5vw', y: '-1vh', rotate: 0, scale: 0.965 },
  ],
  links: [
    { x: '1vw', y: '0vh', rotate: -3, scale: 1.0 },
    { x: '2.5vw', y: '-0.75vh', rotate: 2, scale: 0.985 },
    { x: '3.75vw', y: '-2vh', rotate: -1, scale: 0.97 },
    { x: '4.5vw', y: '-3.4vh', rotate: 1, scale: 0.955 },
    { x: '5vw', y: '-4.2vh', rotate: 0, scale: 0.945 },
  ],
  drafts: [
    { x: '0vw', y: '-0.75vh', rotate: 4, scale: 1.0 },
    { x: '0.8vw', y: '-1.75vh', rotate: -2, scale: 0.985 },
    { x: '1.6vw', y: '-3vh', rotate: 2, scale: 0.97 },
    { x: '2.3vw', y: '-4.1vh', rotate: -1, scale: 0.955 },
    { x: '2.9vw', y: '-4.9vh', rotate: 0, scale: 0.945 },
  ],
  threads: [
    { x: '-1vw', y: '0vh', rotate: -3, scale: 1.0 },
    { x: '-2.5vw', y: '-0.75vh', rotate: 2, scale: 0.985 },
    { x: '-3.75vw', y: '-2vh', rotate: -1, scale: 0.97 },
    { x: '-4.5vw', y: '-3.4vh', rotate: 1, scale: 0.955 },
    { x: '-5vw', y: '-4.2vh', rotate: 0, scale: 0.945 },
  ],
  clips: [
    { x: '0vw', y: '-0.75vh', rotate: 4, scale: 1.0 },
    { x: '-0.8vw', y: '-1.75vh', rotate: -2, scale: 0.985 },
    { x: '-1.6vw', y: '-3vh', rotate: 2, scale: 0.97 },
    { x: '-2.3vw', y: '-4.1vh', rotate: -1, scale: 0.955 },
    { x: '-2.9vw', y: '-4.9vh', rotate: 0, scale: 0.945 },
  ],
};

// Chickens waddle toward the coop door (center-bottom) then shrink/fade as they enter.
// Each path has 5 keyframes for fluid motion with alternating rotation (waddle).
// The door is roughly at (50%, 72%) of the scene — chickens from the left move
// rightward and chickens from the right move leftward, all converging on the door.
export const arrivalFlightPaths: Record<
  JourneyChicken['id'],
  Array<{ x: string; y: string; rotate: number; scale?: number; opacity?: number }>
> = {
  tabs: [
    { x: '5vw', y: '-1vh', rotate: -5, scale: 0.98, opacity: 1 },
    { x: '12vw', y: '-2vh', rotate: 4, scale: 0.9, opacity: 1 },
    { x: '19vw', y: '-3vh', rotate: -3, scale: 0.72, opacity: 0.94 },
    { x: '24vw', y: '-2vh', rotate: 2, scale: 0.4, opacity: 0.42 },
    { x: '27vw', y: '-1vh', rotate: 0, scale: 0.08, opacity: 0 },
  ],
  notes: [
    { x: '3vw', y: '0vh', rotate: 5, scale: 0.97, opacity: 1 },
    { x: '8vw', y: '-1vh', rotate: -4, scale: 0.88, opacity: 1 },
    { x: '13vw', y: '-2vh', rotate: 3, scale: 0.68, opacity: 0.92 },
    { x: '17vw', y: '-1vh', rotate: -2, scale: 0.38, opacity: 0.38 },
    { x: '19vw', y: '0vh', rotate: 0, scale: 0.08, opacity: 0 },
  ],
  ideas: [
    { x: '-3vw', y: '0vh', rotate: -5, scale: 0.97, opacity: 1 },
    { x: '-8vw', y: '-1vh', rotate: 4, scale: 0.88, opacity: 1 },
    { x: '-13vw', y: '-2vh', rotate: -3, scale: 0.68, opacity: 0.92 },
    { x: '-17vw', y: '-1vh', rotate: 2, scale: 0.38, opacity: 0.38 },
    { x: '-19vw', y: '0vh', rotate: 0, scale: 0.08, opacity: 0 },
  ],
  signals: [
    { x: '-5vw', y: '-1vh', rotate: 5, scale: 0.98, opacity: 1 },
    { x: '-12vw', y: '-2vh', rotate: -4, scale: 0.9, opacity: 1 },
    { x: '-19vw', y: '-3vh', rotate: 3, scale: 0.72, opacity: 0.94 },
    { x: '-24vw', y: '-2vh', rotate: -2, scale: 0.4, opacity: 0.42 },
    { x: '-27vw', y: '-1vh', rotate: 0, scale: 0.08, opacity: 0 },
  ],
  links: [
    { x: '2vw', y: '0vh', rotate: -4, scale: 0.95, opacity: 1 },
    { x: '7vw', y: '-1vh', rotate: 3, scale: 0.86, opacity: 1 },
    { x: '12vw', y: '-2vh', rotate: -2, scale: 0.64, opacity: 0.9 },
    { x: '16vw', y: '-1vh', rotate: 1, scale: 0.34, opacity: 0.34 },
    { x: '18vw', y: '0vh', rotate: 0, scale: 0.07, opacity: 0 },
  ],
  drafts: [
    { x: '2vw', y: '1vh', rotate: 3, scale: 0.93, opacity: 1 },
    { x: '5vw', y: '0vh', rotate: -3, scale: 0.82, opacity: 1 },
    { x: '9vw', y: '-1vh', rotate: 2, scale: 0.58, opacity: 0.88 },
    { x: '12vw', y: '0vh', rotate: -1, scale: 0.3, opacity: 0.3 },
    { x: '13vw', y: '1vh', rotate: 0, scale: 0.06, opacity: 0 },
  ],
  threads: [
    { x: '-2vw', y: '0vh', rotate: 4, scale: 0.95, opacity: 1 },
    { x: '-7vw', y: '-1vh', rotate: -3, scale: 0.86, opacity: 1 },
    { x: '-12vw', y: '-2vh', rotate: 2, scale: 0.64, opacity: 0.9 },
    { x: '-16vw', y: '-1vh', rotate: -1, scale: 0.34, opacity: 0.34 },
    { x: '-18vw', y: '0vh', rotate: 0, scale: 0.07, opacity: 0 },
  ],
  clips: [
    { x: '-2vw', y: '1vh', rotate: -3, scale: 0.93, opacity: 1 },
    { x: '-5vw', y: '0vh', rotate: 3, scale: 0.82, opacity: 1 },
    { x: '-9vw', y: '-1vh', rotate: -2, scale: 0.58, opacity: 0.88 },
    { x: '-12vw', y: '0vh', rotate: 1, scale: 0.3, opacity: 0.3 },
    { x: '-13vw', y: '1vh', rotate: 0, scale: 0.06, opacity: 0 },
  ],
};

export const chickenThoughts: Record<JourneyChicken['id'], string> = {
  tabs: 'Open browser tabs',
  notes: 'Meeting notes & memos',
  ideas: 'Sparks worth exploring',
  signals: 'Trends & opportunities',
  links: 'Saved references',
  drafts: 'Work in progress',
  threads: 'Conversation fragments',
  clips: 'Audio & video moments',
};

export const STAR_COUNT = 14;

export const emptyLandingTranscripts: TranscriptMap = {
  capital: '',
  impact: '',
  governance: '',
  knowledge: '',
};

export function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function compact<T>(values: Array<T | null | undefined>) {
  return values.filter((value): value is T => value != null);
}

export function cloneSetupInput() {
  return { ...emptySetupInsightsInput };
}

export function cloneTranscripts() {
  return { ...emptyLandingTranscripts };
}

export function createEmptyLandingDraft(): LandingDraft {
  return {
    version: 2,
    audience: 'community',
    openCardId: null,
    sharedNotes: '',
    setupInput: cloneSetupInput(),
    transcripts: cloneTranscripts(),
  };
}

export function isTranscriptKey(value: unknown): value is TranscriptKey {
  return (
    value === 'capital' || value === 'impact' || value === 'governance' || value === 'knowledge'
  );
}

export function isAudienceId(value: unknown): value is AudienceId {
  return value === 'persona' || value === 'family' || value === 'friends' || value === 'community';
}

export function mergeSetupInput(value: unknown): SetupInsightsInput {
  const next = cloneSetupInput();

  if (!value || typeof value !== 'object') {
    return next;
  }

  for (const key of Object.keys(emptySetupInsightsInput) as SetupFieldKey[]) {
    const candidate = (value as Record<string, unknown>)[key];

    if (typeof candidate === 'string') {
      next[key] = candidate;
    }
  }

  return next;
}

export function mergeTranscripts(value: unknown): TranscriptMap {
  const next = cloneTranscripts();

  if (!value || typeof value !== 'object') {
    return next;
  }

  for (const key of Object.keys(emptyLandingTranscripts) as TranscriptKey[]) {
    const candidate = (value as Record<string, unknown>)[key];

    if (typeof candidate === 'string') {
      next[key] = candidate;
    }
  }

  return next;
}

export function readLandingDraft(): LandingDraft {
  if (typeof window === 'undefined') {
    return createEmptyLandingDraft();
  }

  try {
    const rawDraft = window.localStorage.getItem(LANDING_DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return createEmptyLandingDraft();
    }

    const parsed = JSON.parse(rawDraft) as Record<string, unknown>;

    return {
      version: 2,
      audience: isAudienceId(parsed.audience) ? parsed.audience : 'community',
      openCardId: isTranscriptKey(parsed.openCardId) ? parsed.openCardId : null,
      sharedNotes: typeof parsed.sharedNotes === 'string' ? parsed.sharedNotes : '',
      setupInput: mergeSetupInput(parsed.setupInput),
      transcripts: mergeTranscripts(parsed.transcripts),
    };
  } catch {
    return createEmptyLandingDraft();
  }
}

export function resolveSpeechRecognitionConstructor(target: Window & typeof globalThis) {
  const speechWindow = target as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function resolveSpeechError(error?: string) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone or speech permissions were denied. Type notes manually for this card.';
    case 'audio-capture':
      return 'No microphone is available here. You can still type notes into the card.';
    case 'no-speech':
      return 'No speech was detected. Try again or type notes manually.';
    default:
      return 'Live transcript stopped unexpectedly. Your typed notes are still safe.';
  }
}

export function getLensProgress(
  mapping: RitualCardMapping,
  setupInput: SetupInsightsInput,
  transcripts: TranscriptMap,
): LensProgress {
  const transcript = cleanText(transcripts[mapping.id]);
  const current = cleanText(setupInput[mapping.currentKey]);
  const pain = cleanText(setupInput[mapping.painKey]);
  const improve = cleanText(setupInput[mapping.improveKey]);
  const filledCount = [transcript, current, pain, improve].filter(Boolean).length;
  const captureReady = Boolean(transcript || current || pain || improve);
  const distillReady = [current, pain, improve].filter(Boolean).length >= 2;
  const status: LensStatus =
    current && pain && improve ? 'ready' : filledCount > 0 ? 'drafting' : 'empty';

  return {
    captureReady,
    distillReady,
    status,
    filledCount,
  };
}

export function statusLabel(status: LensStatus) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'drafting':
      return 'In progress';
    default:
      return 'Not started';
  }
}

export function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

export function buildPacketFilename(coopName: string) {
  const cleaned = cleanText(coopName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${cleaned || 'coop'}-setup-packet.json`;
}

export function buildLandingSetupPacket(
  setupInput: SetupInsightsInput,
  transcripts: TranscriptMap,
  options: LandingPacketOptions = {},
) {
  const spaceType = options.audience ? audienceToSpaceType[options.audience] : 'community';
  const setupInsights = toSetupInsights(setupInput, spaceType);

  return {
    coopName: cleanText(setupInput.coopName) || 'This coop',
    purpose: cleanText(setupInput.purpose) || 'Keep useful context from getting loose.',
    audience: options.audience ?? 'community',
    sharedNotes: cleanText(options.sharedNotes ?? ''),
    summary: setupInsights.summary,
    setupInsights,
    transcripts: {
      moneyAndResources: cleanText(transcripts.capital),
      impactAndProgress: cleanText(transcripts.impact),
      decisionsAndTeamwork: cleanText(transcripts.governance),
      knowledgeAndTools: cleanText(transcripts.knowledge),
    },
  };
}

export function starStyle(index: number): React.CSSProperties {
  const golden = 0.618033988749895;
  const x = (index * golden * 137.508) % 100;
  const y = (index * golden * 83.7) % 60;
  const size = 1.5 + (index % 4) * 0.7;
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: `${size}px`,
    height: `${size}px`,
  };
}
