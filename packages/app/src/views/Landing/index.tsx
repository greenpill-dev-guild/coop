import {
  type CoopSpaceType,
  type SetupInsightsInput,
  emptySetupInsightsInput,
  getRitualLenses,
  toSetupInsights,
} from '@coop/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DevTunnelBadge } from '../../components/DevTunnelBadge';
import type { DevEnvironmentState } from '../../dev-environment';

type TranscriptKey = 'capital' | 'impact' | 'governance' | 'knowledge';
type TranscriptMap = Record<TranscriptKey, string>;
type SetupFieldKey = keyof SetupInsightsInput;
type LensStatus = 'empty' | 'drafting' | 'ready';
type AudienceId = 'persona' | 'family' | 'friends' | 'community';

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  abort?: () => void;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

type ChickenVariant = 'adult' | 'young' | 'chick';

type JourneyChicken = {
  id: string;
  label: string;
  variant?: ChickenVariant;
};

type RitualCardMapping = {
  id: TranscriptKey;
  currentKey: SetupFieldKey;
  painKey: SetupFieldKey;
  improveKey: SetupFieldKey;
};

type LensProgress = {
  captureReady: boolean;
  distillReady: boolean;
  status: LensStatus;
  filledCount: number;
};

type LandingDraft = {
  version: number;
  audience: AudienceId;
  openCardId: TranscriptKey | null;
  sharedNotes: string;
  setupInput: SetupInsightsInput;
  transcripts: TranscriptMap;
};

type LandingPacketOptions = {
  audience?: AudienceId;
  sharedNotes?: string;
};

type AudienceOption = {
  id: AudienceId;
  label: string;
};

type StoryCard = {
  title: string;
  detail: string;
};

const LANDING_DRAFT_STORAGE_KEY = 'coop-landing-ritual-v2';
const defaultTranscriptStatus =
  'Use live transcript if this browser supports it, or type directly into the card. Everything stays saved on this device.';

const journeyChickens: JourneyChicken[] = [
  { id: 'tabs', label: 'Tabs' },
  { id: 'notes', label: 'Notes' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'signals', label: 'Signals' },
  { id: 'links', label: 'Links', variant: 'young' },
  { id: 'drafts', label: 'Drafts', variant: 'chick' },
  { id: 'threads', label: 'Threads', variant: 'young' },
  { id: 'clips', label: 'Clips', variant: 'chick' },
];

const audienceOptions: AudienceOption[] = [
  { id: 'persona', label: 'Personal' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'community', label: 'Community' },
];

const audienceToSpaceType: Record<AudienceId, CoopSpaceType> = {
  persona: 'personal',
  family: 'family',
  friends: 'friends',
  community: 'community',
};

const ritualCardMappings: RitualCardMapping[] = [
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

const howItWorksCards: StoryCard[] = [
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

const teamMembers = ['Afolabi Aiyeloja', 'Luiz Fernando', 'Sofia Villareal'];
const partnerMarks = [
  'Regen Coordination',
  'Greenpill',
  'Greenpill Dev Guild',
  'ReFi DAO',
  'Green Goods',
];

const storyFlightPaths: Record<
  JourneyChicken['id'],
  Array<{ x: string; y: string; rotate: number; scale?: number }>
> = {
  tabs: [
    { x: '8vw', y: '-2vh', rotate: -10, scale: 1.02 },
    { x: '14vw', y: '-5vh', rotate: -4, scale: 0.96 },
    { x: '10vw', y: '-8vh', rotate: 0, scale: 0.88 },
  ],
  notes: [
    { x: '7vw', y: '2vh', rotate: 8, scale: 1.01 },
    { x: '12vw', y: '-1vh', rotate: 4, scale: 0.95 },
    { x: '8vw', y: '-6vh', rotate: 0, scale: 0.88 },
  ],
  ideas: [
    { x: '-7vw', y: '2vh', rotate: -8, scale: 1.01 },
    { x: '-4vw', y: '-1vh', rotate: -2, scale: 0.95 },
    { x: '6vw', y: '-6vh', rotate: 0, scale: 0.88 },
  ],
  signals: [
    { x: '-8vw', y: '-2vh', rotate: 10, scale: 1.02 },
    { x: '-4vw', y: '-5vh', rotate: 4, scale: 0.96 },
    { x: '8vw', y: '-8vh', rotate: 0, scale: 0.88 },
  ],
  links: [
    { x: '5vw', y: '-1vh', rotate: -6, scale: 1.0 },
    { x: '10vw', y: '-4vh', rotate: -2, scale: 0.93 },
    { x: '7vw', y: '-7vh', rotate: 0, scale: 0.85 },
  ],
  drafts: [
    { x: '4vw', y: '1vh', rotate: 5, scale: 1.0 },
    { x: '8vw', y: '-2vh', rotate: 2, scale: 0.92 },
    { x: '9vw', y: '-5vh', rotate: 0, scale: 0.84 },
  ],
  threads: [
    { x: '-5vw', y: '-1vh', rotate: 6, scale: 1.0 },
    { x: '-2vw', y: '-4vh', rotate: 2, scale: 0.93 },
    { x: '7vw', y: '-7vh', rotate: 0, scale: 0.85 },
  ],
  clips: [
    { x: '-4vw', y: '1vh', rotate: -5, scale: 1.0 },
    { x: '-1vw', y: '-2vh', rotate: -1, scale: 0.92 },
    { x: '9vw', y: '-5vh', rotate: 0, scale: 0.84 },
  ],
};

// Chickens waddle toward the coop door (center-bottom) then shrink/fade as they enter.
// Each path has 5 keyframes for fluid motion with alternating rotation (waddle).
// The door is roughly at (50%, 72%) of the scene — chickens from the left move
// rightward and chickens from the right move leftward, all converging on the door.
const arrivalFlightPaths: Record<
  JourneyChicken['id'],
  Array<{ x: string; y: string; rotate: number; scale?: number; opacity?: number }>
> = {
  tabs: [
    { x: '4vw', y: '-1vh', rotate: -5, scale: 0.96, opacity: 1 },
    { x: '12vw', y: '-3vh', rotate: 4, scale: 0.88, opacity: 1 },
    { x: '20vw', y: '-5vh', rotate: -3, scale: 0.68, opacity: 0.9 },
    { x: '28vw', y: '-6vh', rotate: 2, scale: 0.42, opacity: 0.45 },
    { x: '34vw', y: '-7vh', rotate: 0, scale: 0.18, opacity: 0 },
  ],
  notes: [
    { x: '3vw', y: '0vh', rotate: 5, scale: 0.95, opacity: 1 },
    { x: '9vw', y: '-2vh', rotate: -4, scale: 0.85, opacity: 1 },
    { x: '16vw', y: '-4vh', rotate: 3, scale: 0.66, opacity: 0.88 },
    { x: '22vw', y: '-5vh', rotate: -2, scale: 0.4, opacity: 0.4 },
    { x: '26vw', y: '-6vh', rotate: 0, scale: 0.16, opacity: 0 },
  ],
  ideas: [
    { x: '-3vw', y: '0vh', rotate: -5, scale: 0.95, opacity: 1 },
    { x: '-9vw', y: '-2vh', rotate: 4, scale: 0.85, opacity: 1 },
    { x: '-16vw', y: '-4vh', rotate: -3, scale: 0.66, opacity: 0.88 },
    { x: '-22vw', y: '-5vh', rotate: 2, scale: 0.4, opacity: 0.4 },
    { x: '-26vw', y: '-6vh', rotate: 0, scale: 0.16, opacity: 0 },
  ],
  signals: [
    { x: '-4vw', y: '-1vh', rotate: 5, scale: 0.96, opacity: 1 },
    { x: '-12vw', y: '-3vh', rotate: -4, scale: 0.88, opacity: 1 },
    { x: '-20vw', y: '-5vh', rotate: 3, scale: 0.68, opacity: 0.9 },
    { x: '-28vw', y: '-6vh', rotate: -2, scale: 0.42, opacity: 0.45 },
    { x: '-34vw', y: '-7vh', rotate: 0, scale: 0.18, opacity: 0 },
  ],
  links: [
    { x: '2vw', y: '0vh', rotate: -4, scale: 0.93, opacity: 1 },
    { x: '8vw', y: '-2vh', rotate: 3, scale: 0.82, opacity: 1 },
    { x: '15vw', y: '-4vh', rotate: -2, scale: 0.62, opacity: 0.85 },
    { x: '24vw', y: '-6vh', rotate: 1, scale: 0.36, opacity: 0.35 },
    { x: '30vw', y: '-7vh', rotate: 0, scale: 0.14, opacity: 0 },
  ],
  drafts: [
    { x: '2vw', y: '1vh', rotate: 3, scale: 0.91, opacity: 1 },
    { x: '6vw', y: '-1vh', rotate: -3, scale: 0.78, opacity: 1 },
    { x: '12vw', y: '-3vh', rotate: 2, scale: 0.58, opacity: 0.82 },
    { x: '18vw', y: '-5vh', rotate: -1, scale: 0.34, opacity: 0.32 },
    { x: '22vw', y: '-6vh', rotate: 0, scale: 0.12, opacity: 0 },
  ],
  threads: [
    { x: '-2vw', y: '0vh', rotate: 4, scale: 0.93, opacity: 1 },
    { x: '-8vw', y: '-2vh', rotate: -3, scale: 0.82, opacity: 1 },
    { x: '-15vw', y: '-4vh', rotate: 2, scale: 0.62, opacity: 0.85 },
    { x: '-24vw', y: '-6vh', rotate: -1, scale: 0.36, opacity: 0.35 },
    { x: '-30vw', y: '-7vh', rotate: 0, scale: 0.14, opacity: 0 },
  ],
  clips: [
    { x: '-2vw', y: '1vh', rotate: -3, scale: 0.91, opacity: 1 },
    { x: '-6vw', y: '-1vh', rotate: 3, scale: 0.78, opacity: 1 },
    { x: '-12vw', y: '-3vh', rotate: -2, scale: 0.58, opacity: 0.82 },
    { x: '-18vw', y: '-5vh', rotate: 1, scale: 0.34, opacity: 0.32 },
    { x: '-22vw', y: '-6vh', rotate: 0, scale: 0.12, opacity: 0 },
  ],
};

const STAR_COUNT = 10;

function starStyle(index: number): React.CSSProperties {
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

export const emptyLandingTranscripts: TranscriptMap = {
  capital: '',
  impact: '',
  governance: '',
  knowledge: '',
};

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function compact<T>(values: Array<T | null | undefined>) {
  return values.filter((value): value is T => value != null);
}

function cloneSetupInput() {
  return { ...emptySetupInsightsInput };
}

function cloneTranscripts() {
  return { ...emptyLandingTranscripts };
}

function createEmptyLandingDraft(): LandingDraft {
  return {
    version: 2,
    audience: 'community',
    openCardId: null,
    sharedNotes: '',
    setupInput: cloneSetupInput(),
    transcripts: cloneTranscripts(),
  };
}

function isTranscriptKey(value: unknown): value is TranscriptKey {
  return (
    value === 'capital' || value === 'impact' || value === 'governance' || value === 'knowledge'
  );
}

function isAudienceId(value: unknown): value is AudienceId {
  return value === 'persona' || value === 'family' || value === 'friends' || value === 'community';
}

function mergeSetupInput(value: unknown): SetupInsightsInput {
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

function mergeTranscripts(value: unknown): TranscriptMap {
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

function readLandingDraft(): LandingDraft {
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

function resolveSpeechRecognitionConstructor(target: Window & typeof globalThis) {
  const speechWindow = target as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function resolveSpeechError(error?: string) {
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

function getLensProgress(
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

function statusLabel(status: LensStatus) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'drafting':
      return 'In progress';
    default:
      return 'Not started';
  }
}

function initialsForName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function buildPacketFilename(coopName: string) {
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

function ChickenSprite({
  label,
  showLabel = true,
  variant = 'adult',
}: { label: string; showLabel?: boolean; variant?: ChickenVariant }) {
  const variantClass = variant !== 'adult' ? ` chicken-${variant}` : '';

  return (
    <>
      <svg
        aria-hidden="true"
        className={`scene-chicken-svg${variantClass}`}
        viewBox="0 0 150 118"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="chicken-tail"
          d="M34 61c-10-8-14-19-11-31 16 0 30 6 38 18-6 8-15 12-27 13Z"
        />
        <path
          className="chicken-body"
          d="M42 31c15-10 38-13 61-6 27 9 42 31 36 52-5 19-25 31-48 31-18 0-35-6-46-18-16-16-18-41-3-59Z"
        />
        <path
          className="chicken-wing"
          d="M78 53c17 1 30 11 31 24 0 9-8 17-19 20-15-2-25-10-26-21 0-11 6-19 14-23Z"
        />
        <path
          className="chicken-comb"
          d="M80 22c4-9 9-14 16-14 5 0 9 3 12 8 5-5 11-6 17-1 5 5 6 12 1 21H82c-6-3-7-8-2-14Z"
        />
        <circle className="chicken-eye" cx="104" cy="49" r="3.3" />
        <path className="chicken-beak" d="M117 54l22 6-22 8-4-7 4-7Z" />
        <path className="chicken-leg" d="M66 100v15" />
        <path className="chicken-leg" d="M90 103v15" />
        <path className="chicken-foot" d="M60 116h12" />
        <path className="chicken-foot" d="M84 118h12" />
      </svg>
      {showLabel ? <span className="scene-chicken-label">{label}</span> : null}
    </>
  );
}

function CoopIllustration() {
  return (
    <svg
      aria-hidden="true"
      className="scene-coop-svg"
      viewBox="0 0 320 278"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="coop-roof" d="M67 94L160 26l93 68-16 18H83z" />
      <rect className="coop-body" x="56" y="94" width="208" height="154" rx="30" />
      <rect className="coop-window" x="88" y="124" width="54" height="54" rx="14" />
      <rect className="coop-window" x="178" y="124" width="54" height="54" rx="14" />
      <rect className="coop-door" x="134" y="170" width="52" height="78" rx="16" />
      <path className="coop-slat" d="M104 104v132" />
      <path className="coop-slat" d="M160 104v132" />
      <path className="coop-slat" d="M216 104v132" />
      <path className="coop-trim" d="M56 152h208" />
    </svg>
  );
}

export function App({
  appHref = '/pair',
  devEnvironment = null,
}: {
  appHref?: string;
  devEnvironment?: DevEnvironmentState | null;
}) {
  const initialDraftRef = useRef<LandingDraft | null>(null);

  if (!initialDraftRef.current) {
    initialDraftRef.current = readLandingDraft();
  }

  const initialDraft = initialDraftRef.current;

  const landingRootRef = useRef<HTMLDivElement | null>(null);
  const storyJourneyRef = useRef<HTMLElement | null>(null);
  const arrivalJourneyRef = useRef<HTMLElement | null>(null);
  const ritualSectionRef = useRef<HTMLElement | null>(null);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const howItWorksRef = useRef<HTMLDivElement | null>(null);
  const whyBuildRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionHadErrorRef = useRef(false);

  const storySunRef = useRef<HTMLDivElement | null>(null);
  const storyGlowLeftRef = useRef<HTMLDivElement | null>(null);
  const storyGlowRightRef = useRef<HTMLDivElement | null>(null);
  const storyCloudARef = useRef<HTMLDivElement | null>(null);
  const storyCloudBRef = useRef<HTMLDivElement | null>(null);
  const storyHillBackRef = useRef<HTMLDivElement | null>(null);
  const storyHillMidRef = useRef<HTMLDivElement | null>(null);
  const storyHillFrontRef = useRef<HTMLDivElement | null>(null);
  const storyPathRef = useRef<HTMLDivElement | null>(null);
  const storyCoopRef = useRef<HTMLDivElement | null>(null);

  const arrivalGlowLeftRef = useRef<HTMLDivElement | null>(null);
  const arrivalGlowRightRef = useRef<HTMLDivElement | null>(null);
  const arrivalCloudRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillBackRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillMidRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillFrontRef = useRef<HTMLDivElement | null>(null);
  const arrivalPathRef = useRef<HTMLDivElement | null>(null);
  const arrivalCoopRef = useRef<HTMLDivElement | null>(null);
  const arrivalInsideFlockRef = useRef<HTMLDivElement | null>(null);

  const storySkyOverlayRef = useRef<HTMLDivElement | null>(null);
  const storySunWarmRef = useRef<HTMLDivElement | null>(null);
  const arrivalStarsRef = useRef<HTMLDivElement | null>(null);
  const arrivalMoonRef = useRef<HTMLDivElement | null>(null);
  const arrivalCoopGlowRef = useRef<HTMLDivElement | null>(null);

  const storyChickenRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const arrivalChickenRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flashcardTriggerRefs = useRef<Record<TranscriptKey, HTMLButtonElement | null>>({
    capital: null,
    impact: null,
    governance: null,
    knowledge: null,
  });
  const flashcardCloseRefs = useRef<Record<TranscriptKey, HTMLButtonElement | null>>({
    capital: null,
    impact: null,
    governance: null,
    knowledge: null,
  });
  const flashcardNotesRefs = useRef<Record<TranscriptKey, HTMLTextAreaElement | null>>({
    capital: null,
    impact: null,
    governance: null,
    knowledge: null,
  });
  const focusOpenCardRef = useRef<TranscriptKey | null>(null);
  const focusReturnCardRef = useRef<TranscriptKey | null>(null);

  const [setupInput, setSetupInput] = useState<SetupInsightsInput>(() => initialDraft.setupInput);
  const [transcripts, setTranscripts] = useState<TranscriptMap>(() => initialDraft.transcripts);
  const [audience, setAudience] = useState<AudienceId>(() => initialDraft.audience);
  const [openCardId, setOpenCardId] = useState<TranscriptKey | null>(null);
  const [sharedNotes, setSharedNotes] = useState(() => initialDraft.sharedNotes);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [recordingLens, setRecordingLens] = useState<TranscriptKey | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState(defaultTranscriptStatus);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [showResetButton, setShowResetButton] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  const speechRecognition =
    typeof window === 'undefined' ? null : resolveSpeechRecognitionConstructor(window);
  const spaceType = audienceToSpaceType[audience];
  const ritualLenses = getRitualLenses(spaceType);
  const setupPacket = buildLandingSetupPacket(setupInput, transcripts, { audience, sharedNotes });
  const setupPacketText = JSON.stringify(setupPacket, null, 2);

  const lensProgress = useMemo(
    () => ritualCardMappings.map((mapping) => getLensProgress(mapping, setupInput, transcripts)),
    [setupInput, transcripts],
  );
  const completedLensCount = lensProgress.filter((progress) => progress.status === 'ready').length;
  const activeDraftCount = lensProgress.filter((progress) => progress.captureReady).length;
  const allLensesReady = completedLensCount === ritualCardMappings.length;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      LANDING_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        audience,
        openCardId,
        sharedNotes,
        setupInput,
        transcripts,
      } satisfies LandingDraft),
    );
  }, [audience, openCardId, sharedNotes, setupInput, transcripts]);

  useEffect(() => {
    if (typeof window === 'undefined' || !heroCopyRef.current) {
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      return undefined;
    }

    const heroObserver = new window.IntersectionObserver(
      (entries) => {
        setScrolledPastHero(!(entries[0]?.isIntersecting ?? true));
      },
      { threshold: 0.1 },
    );

    heroObserver.observe(heroCopyRef.current);

    return () => {
      heroObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !ritualSectionRef.current) {
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setShowResetButton(true);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const activeEntry = entries[0];
        setShowResetButton(activeEntry?.isIntersecting ?? false);
      },
      {
        rootMargin: '-96px 0px -28% 0px',
        threshold: 0.01,
      },
    );

    observer.observe(ritualSectionRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const isTestEnvironment =
      typeof navigator !== 'undefined' && /jsdom|happy-dom/i.test(navigator.userAgent);

    if (
      typeof window === 'undefined' ||
      prefersReducedMotion ||
      isTestEnvironment ||
      window.innerWidth <= 1024
    ) {
      return undefined;
    }

    let cancelled = false;
    let revertAnimations = () => undefined;

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([gsapModule, scrollTriggerModule]) => {
        if (cancelled) {
          return;
        }

        const { gsap } = gsapModule;
        const { ScrollTrigger } = scrollTriggerModule;
        const scope = landingRootRef.current;

        if (!scope || !storyJourneyRef.current || !arrivalJourneyRef.current) {
          return;
        }

        gsap.registerPlugin(ScrollTrigger);

        const context = gsap.context(() => {
          const storyChickens = compact(
            journeyChickens.map((chicken) => storyChickenRefs.current[chicken.id]),
          );
          const arrivalChickens = compact(
            journeyChickens.map((chicken) => arrivalChickenRefs.current[chicken.id]),
          );
          const howItWorksHeading =
            howItWorksRef.current?.querySelector<HTMLDivElement>('.how-works-heading') ?? null;
          const howItWorksCards = Array.from(
            howItWorksRef.current?.querySelectorAll<HTMLElement>('.how-works-card') ?? [],
          );

          const storyCoopParts = {
            roof: storyCoopRef.current?.querySelector('.coop-roof') ?? null,
            body: storyCoopRef.current?.querySelector('.coop-body') ?? null,
            frames: Array.from(
              storyCoopRef.current?.querySelectorAll(
                '.coop-window, .coop-door, .coop-slat, .coop-trim',
              ) ?? [],
            ),
          };

          const arrivalCoopParts = {
            roof: arrivalCoopRef.current?.querySelector('.coop-roof') ?? null,
            body: arrivalCoopRef.current?.querySelector('.coop-body') ?? null,
            frames: Array.from(
              arrivalCoopRef.current?.querySelectorAll(
                '.coop-window, .coop-door, .coop-slat, .coop-trim',
              ) ?? [],
            ),
          };

          gsap.set(storyChickens, { transformOrigin: '50% 50%' });
          gsap.set(arrivalChickens, { transformOrigin: '50% 50%', opacity: 0.94 });
          gsap.set(compact([storyCoopParts.roof, storyCoopParts.body]), {
            transformOrigin: '50% 100%',
          });
          gsap.set(compact([arrivalCoopParts.roof, arrivalCoopParts.body]), {
            transformOrigin: '50% 100%',
          });
          gsap.set(storyCoopParts.frames, { transformOrigin: '50% 50%' });
          gsap.set(arrivalCoopParts.frames, { transformOrigin: '50% 50%' });
          gsap.set(howItWorksCards, { transformOrigin: '50% 50%' });

          const storyTimeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: storyJourneyRef.current,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 1.1,
            },
          });

          storyTimeline
            .fromTo(
              storyGlowLeftRef.current,
              { x: '-8vw', y: '-2vh', scale: 0.92 },
              { x: '10vw', y: '8vh', scale: 1.18 },
              0,
            )
            .fromTo(
              storyGlowRightRef.current,
              { x: '6vw', y: '-4vh', scale: 0.96 },
              { x: '-12vw', y: '5vh', scale: 1.12 },
              0,
            )
            .fromTo(
              storySunRef.current,
              { x: '2vw', y: '-4vh', scale: 0.95 },
              { x: '-22vw', y: '62vh', scale: 1.45 },
              0,
            )
            .fromTo(storyCloudARef.current, { x: '-4vw', y: 0 }, { x: '10vw', y: '6vh' }, 0)
            .fromTo(storyCloudBRef.current, { x: '2vw', y: 0 }, { x: '-8vw', y: '4vh' }, 0)
            .fromTo(
              storyHillBackRef.current,
              { x: '-2vw', y: '2vh', scaleX: 1.02 },
              { x: '6vw', y: '-3vh', scaleX: 1.08 },
              0,
            )
            .fromTo(
              storyHillMidRef.current,
              { x: '1vw', y: 0, scaleX: 1 },
              { x: '-7vw', y: '-4vh', scaleX: 1.08 },
              0,
            )
            .fromTo(
              storyHillFrontRef.current,
              { x: '-1vw', y: 0, scaleX: 1 },
              { x: '9vw', y: '-5vh', scaleX: 1.09 },
              0,
            )
            .fromTo(
              storyPathRef.current,
              { scaleX: 0.82, scaleY: 0.94, rotate: -10, opacity: 0.3 },
              { scaleX: 1.12, scaleY: 1.08, rotate: -4, opacity: 0.78 },
              0.12,
            )
            .fromTo(
              storyCoopParts.body,
              { y: 80, scale: 0.72, autoAlpha: 0.18 },
              { y: 0, scale: 1, autoAlpha: 0.98 },
              0.22,
            )
            .fromTo(
              storyCoopParts.roof,
              { y: -70, scaleX: 0.84, autoAlpha: 0 },
              { y: 0, scaleX: 1, autoAlpha: 1 },
              0.34,
            )
            .fromTo(
              storyCoopParts.frames,
              { y: 18, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, stagger: 0.04 },
              0.44,
            )
            .fromTo(heroCopyRef.current, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -32 }, 0.5)
            .fromTo(howItWorksRef.current, { autoAlpha: 0.55 }, { autoAlpha: 1 }, 0.38)
            .fromTo(howItWorksHeading, { autoAlpha: 0.6, y: 34 }, { autoAlpha: 1, y: 0 }, 0.4)
            .fromTo(
              howItWorksCards,
              {
                autoAlpha: 0.55,
                y: 48,
                scale: 0.96,
              },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                stagger: 0.08,
              },
              0.42,
            )
            .to(
              howItWorksCards,
              {
                autoAlpha: 0.35,
                y: -24,
                scale: 0.98,
                stagger: {
                  each: 0.05,
                  from: 'end',
                },
              },
              0.92,
            )
            .to(howItWorksRef.current, { autoAlpha: 0.4, y: -36 }, 0.94);

          storyTimeline
            .fromTo(storySkyOverlayRef.current, { opacity: 0 }, { opacity: 0.88 }, 0.15)
            .fromTo(
              storySunWarmRef.current,
              { opacity: 0, scale: 0.8 },
              { opacity: 1, scale: 1.2 },
              0.28,
            )
            .to(
              storyHillBackRef.current,
              {
                background:
                  'linear-gradient(180deg, rgba(82, 98, 48, 0.92), rgba(58, 72, 30, 0.95))',
              },
              0.3,
            )
            .to(
              storyHillMidRef.current,
              {
                background:
                  'linear-gradient(180deg, rgba(62, 78, 34, 0.96), rgba(46, 58, 22, 0.98))',
              },
              0.35,
            )
            .to(
              storyHillFrontRef.current,
              {
                background: 'linear-gradient(180deg, rgba(48, 62, 24, 0.98), rgba(36, 48, 16, 1))',
              },
              0.4,
            );

          for (const chicken of journeyChickens) {
            const node = storyChickenRefs.current[chicken.id];
            const path = storyFlightPaths[chicken.id];

            if (!node || !path) {
              continue;
            }

            storyTimeline.to(
              node,
              {
                keyframes: path.map((frame) => ({
                  x: frame.x,
                  y: frame.y,
                  rotation: frame.rotate,
                  scale: frame.scale ?? 1,
                })),
              },
              0,
            );
          }

          const arrivalTimeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: arrivalJourneyRef.current,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 1.15,
            },
          });

          arrivalTimeline
            .fromTo(
              arrivalGlowLeftRef.current,
              { x: '-10vw', y: '3vh', scale: 0.9 },
              { x: '6vw', y: '-4vh', scale: 1.04 },
              0,
            )
            .fromTo(
              arrivalGlowRightRef.current,
              { x: '12vw', y: '4vh', scale: 0.92 },
              { x: '-6vw', y: '-5vh', scale: 1.06 },
              0,
            )
            .fromTo(arrivalCloudRef.current, { x: '-4vw', y: 0 }, { x: '8vw', y: '5vh' }, 0)
            .fromTo(arrivalHillBackRef.current, { x: '3vw', y: '2vh' }, { x: '-5vw', y: '-3vh' }, 0)
            .fromTo(arrivalHillMidRef.current, { x: '-2vw', y: 0 }, { x: '6vw', y: '-4vh' }, 0)
            .fromTo(arrivalHillFrontRef.current, { x: '2vw', y: 0 }, { x: '-4vw', y: '-5vh' }, 0)
            .fromTo(
              arrivalPathRef.current,
              { scaleX: 0.88, rotate: 8, opacity: 0.2 },
              { scaleX: 1.06, rotate: 0, opacity: 0.68 },
              0.08,
            )
            .fromTo(
              arrivalCoopParts.body,
              { y: 110, scale: 0.74, autoAlpha: 0.22 },
              { y: 0, scale: 1, autoAlpha: 1 },
              0.12,
            )
            .fromTo(
              arrivalCoopParts.roof,
              { y: -86, scaleX: 0.78, autoAlpha: 0 },
              { y: 0, scaleX: 1, autoAlpha: 1 },
              0.22,
            )
            .fromTo(
              arrivalCoopParts.frames,
              { y: 18, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, stagger: 0.04 },
              0.3,
            )
            .fromTo(
              arrivalInsideFlockRef.current,
              { autoAlpha: 0, scale: 0.85 },
              { autoAlpha: 1, scale: 1 },
              0.62,
            );
          arrivalTimeline
            .fromTo(arrivalStarsRef.current, { opacity: 0 }, { opacity: 0.35 }, 0.3)
            .fromTo(arrivalCoopGlowRef.current, { opacity: 0 }, { opacity: 1 }, 0.35)
            .to(arrivalCloudRef.current, { opacity: 0.25 }, 0.15);

          // Stagger chicken arrivals — each starts slightly later for a natural procession
          for (let i = 0; i < journeyChickens.length; i++) {
            const chicken = journeyChickens[i];
            const node = arrivalChickenRefs.current[chicken.id];
            const path = arrivalFlightPaths[chicken.id];

            if (!node || !path) {
              continue;
            }

            const staggerDelay = 0.04 + i * 0.03;

            arrivalTimeline.to(
              node,
              {
                ease: 'power1.inOut',
                keyframes: path.map((frame) => ({
                  x: frame.x,
                  y: frame.y,
                  rotation: frame.rotate,
                  scale: frame.scale ?? 1,
                  opacity: frame.opacity ?? 1,
                })),
              },
              staggerDelay,
            );
          }
        }, scope);

        revertAnimations = () => {
          context.revert();
        };
      },
    );

    return () => {
      cancelled = true;
      revertAnimations();
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;

      if (!recognition) {
        return;
      }

      if (recognition.abort) {
        recognition.abort();
        return;
      }

      recognition.stop();
    };
  }, []);

  useEffect(() => {
    const openCardIdToFocus = focusOpenCardRef.current;

    if (openCardIdToFocus && openCardId === openCardIdToFocus) {
      focusOpenCardRef.current = null;
      const preferredTarget =
        flashcardNotesRefs.current[openCardIdToFocus] ??
        flashcardCloseRefs.current[openCardIdToFocus];

      preferredTarget?.focus();
      return;
    }

    const closedCardId = focusReturnCardRef.current;

    if (!closedCardId || openCardId !== null) {
      return;
    }

    focusReturnCardRef.current = null;
    flashcardTriggerRefs.current[closedCardId]?.focus();
  }, [openCardId]);

  function setStoryChickenRef(id: string) {
    return (node: HTMLDivElement | null) => {
      storyChickenRefs.current[id] = node;
    };
  }

  function setArrivalChickenRef(id: string) {
    return (node: HTMLDivElement | null) => {
      arrivalChickenRefs.current[id] = node;
    };
  }

  function setFlashcardTriggerRef(id: TranscriptKey) {
    return (node: HTMLButtonElement | null) => {
      flashcardTriggerRefs.current[id] = node;
    };
  }

  function setFlashcardCloseRef(id: TranscriptKey) {
    return (node: HTMLButtonElement | null) => {
      flashcardCloseRefs.current[id] = node;
    };
  }

  function setFlashcardNotesRef(id: TranscriptKey) {
    return (node: HTMLTextAreaElement | null) => {
      flashcardNotesRefs.current[id] = node;
    };
  }

  function updateField(key: SetupFieldKey, value: string) {
    setSetupInput((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTranscript(key: TranscriptKey, value: string) {
    setTranscripts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function stopRecognitionNow() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    if (recognition.abort) {
      recognition.abort();
    } else {
      recognition.stop();
    }

    recognitionRef.current = null;
    setRecordingLens(null);
  }

  function stopRecording() {
    if (!recognitionRef.current || !recordingLens) {
      return;
    }

    const lensTitle = ritualLenses.find((l) => l.id === recordingLens)?.title ?? recordingLens;
    setTranscriptStatus(`Saving the ${lensTitle.toLowerCase()} notes...`);
    recognitionRef.current.stop();
  }

  function startRecording(cardId: TranscriptKey) {
    if (!speechRecognition) {
      setTranscriptStatus(
        'This browser does not expose live transcript here yet. Type notes directly into the card.',
      );
      return;
    }

    if (recognitionRef.current) {
      stopRecognitionNow();
    }

    recognitionHadErrorRef.current = false;

    const recognition = new speechRecognition();
    let committedTranscript = cleanText(transcripts[cardId]);

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecordingLens(cardId);
      const lensTitle = ritualLenses.find((l) => l.id === cardId)?.title ?? cardId;
      setTranscriptStatus(`${lensTitle} is listening on this device.`);
    };

    recognition.onresult = (event) => {
      const nextFinalSegments: string[] = [];
      let nextInterimSegment = '';
      const startIndex = Math.max(0, event.resultIndex ?? 0);

      for (const result of Array.from(event.results).slice(startIndex)) {
        const transcript = result[0]?.transcript?.trim();

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          nextFinalSegments.push(transcript);
          continue;
        }

        nextInterimSegment = transcript;
      }

      if (nextFinalSegments.length > 0) {
        committedTranscript = [committedTranscript, nextFinalSegments.join(' ')]
          .filter(Boolean)
          .join(' ');
      }

      updateTranscript(cardId, [committedTranscript, nextInterimSegment].filter(Boolean).join(' '));
    };

    recognition.onerror = (event) => {
      recognitionHadErrorRef.current = true;
      setRecordingLens(null);
      recognitionRef.current = null;
      setTranscriptStatus(resolveSpeechError(event.error));
    };

    recognition.onend = () => {
      setRecordingLens((current) => (current === cardId ? null : current));
      recognitionRef.current = null;

      if (recognitionHadErrorRef.current) {
        return;
      }

      const endTitle = ritualLenses.find((l) => l.id === cardId)?.title ?? cardId;
      setTranscriptStatus(`${endTitle} transcript is ready to edit.`);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function toggleCard(cardId: TranscriptKey) {
    if (recordingLens && recordingLens !== cardId) {
      stopRecording();
    }

    if (recordingLens === cardId) {
      stopRecording();
    }

    setOpenCardId((current) => {
      if (current === cardId) {
        focusReturnCardRef.current = cardId;
        return null;
      }

      focusOpenCardRef.current = cardId;
      return cardId;
    });
  }

  async function copySetupNotes() {
    if (!navigator.clipboard?.writeText) {
      setCopyState('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(setupPacketText);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1800);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  }

  function downloadSetupNotes() {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      return;
    }

    const draftBlob = new Blob([setupPacketText], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(draftBlob);
    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = buildPacketFilename(setupPacket.coopName);
    link.click();

    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 200);
  }

  function resetRitual() {
    stopRecognitionNow();
    setSetupInput(cloneSetupInput());
    setTranscripts(cloneTranscripts());
    setAudience('community');
    setOpenCardId(null);
    setSharedNotes('');
    setTranscriptStatus(defaultTranscriptStatus);
    setCopyState('idle');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LANDING_DRAFT_STORAGE_KEY);
    }
  }

  return (
    <div className="page-shell landing-shell" ref={landingRootRef}>
      <div className="backdrop landing-backdrop" />

      <button
        className={
          showResetButton
            ? 'button button-secondary ritual-reset is-visible'
            : 'button button-secondary ritual-reset'
        }
        onClick={resetRitual}
        type="button"
      >
        Reset ritual
      </button>

      <header className="landing-topbar">
        <div className="topbar">
          <a aria-label="Coop landing page" className="hero-logo" href="#meadow">
            <img className="wordmark" src="/branding/coop-wordmark-flat.png" alt="Coop" />
          </a>
        </div>
      </header>

      <main className="landing-main">
        <section className="journey-section story-journey" id="meadow" ref={storyJourneyRef}>
          <div
            aria-hidden="true"
            className={
              prefersReducedMotion
                ? 'journey-scene journey-scene-story is-static'
                : 'journey-scene journey-scene-story'
            }
          >
            <div className="journey-scene-inner">
              <div className="scene-sky-overlay scene-sky-sunset" ref={storySkyOverlayRef} />
              <div className="scene-glow scene-glow-left" ref={storyGlowLeftRef} />
              <div className="scene-glow scene-glow-right" ref={storyGlowRightRef} />
              <div className="scene-sun" ref={storySunRef}>
                <div className="scene-sun-warm" ref={storySunWarmRef} />
              </div>
              <div className="scene-cloud scene-cloud-a" ref={storyCloudARef} />
              <div className="scene-cloud scene-cloud-b" ref={storyCloudBRef} />
              <div className="scene-hill scene-hill-back" ref={storyHillBackRef} />
              <div className="scene-hill scene-hill-mid" ref={storyHillMidRef} />
              <div className="scene-hill scene-hill-front" ref={storyHillFrontRef} />
              <div className="scene-path" ref={storyPathRef} />

              <div className="scene-coop story-scene-coop" ref={storyCoopRef}>
                <CoopIllustration />
              </div>

              {journeyChickens.map((chicken) => (
                <div
                  className={`scene-chicken scene-chicken-${chicken.id}`}
                  key={chicken.id}
                  ref={setStoryChickenRef(chicken.id)}
                >
                  <ChickenSprite
                    label={chicken.label}
                    showLabel={false}
                    variant={chicken.variant}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="journey-panels">
            <article className="journey-panel hero-panel">
              <div className="hero-shell">
                <div className="hero-copy" ref={heroCopyRef}>
                  <h1 className="hero-title">
                    No more
                    <br />
                    chickens loose.
                  </h1>
                  <p className="hero-subtitle">
                    Your group's knowledge, gathered and ready to act on.
                  </p>
                  <p className="sr-only">
                    Eight chickens start apart in the meadow and converge as you scroll.
                  </p>
                </div>

                <div aria-hidden="true" className="hero-stage" />

                <div
                  className={`hero-scroll-hint${scrolledPastHero ? ' is-hidden' : ''}`}
                  aria-hidden="true"
                >
                  <svg
                    className="hero-scroll-arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label="Scroll down"
                  >
                    <path
                      d="M12 5v14M5 12l7 7 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <DevTunnelBadge environment={devEnvironment} />
              </div>
            </article>

            <article className="journey-panel works-panel" id="how-it-works">
              <div className="how-works-shell" ref={howItWorksRef}>
                <div className="section-heading how-works-heading">
                  <h2>How Coop works</h2>
                  <p className="lede">
                    Coop takes your scattered tabs, meeting notes, and field signals — refines them
                    locally into clear opportunities.
                  </p>
                </div>

                <div className="how-works-grid">
                  {howItWorksCards.map((card, index) => (
                    <article className="how-works-card nest-card" key={card.title}>
                      <div>
                        <h3>{card.title}</h3>
                        <p>{card.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section ritual-section" id="ritual" ref={ritualSectionRef}>
          <div className="section-heading ritual-section-heading">
            <p className="eyebrow">Get started</p>
            <h2>Curate your coop</h2>
            <p className="lede ritual-section-copy">
              Flip each card, capture what matters, and walk away with a clean setup packet.
            </p>
          </div>

          <div className="ritual-game-shell nest-card" data-audience={audience}>
            <div className="audience-picker">
              <div className="audience-chip-group">
                {audienceOptions.map((option) => (
                  <button
                    aria-pressed={option.id === audience}
                    className={option.id === audience ? 'audience-chip is-active' : 'audience-chip'}
                    key={option.id}
                    onClick={() => setAudience(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flashcard-grid">
              {ritualLenses.map((lens, index) => {
                const mapping = ritualCardMappings[index];
                const progress = lensProgress[index];
                const isFlipped = openCardId === lens.id;
                const isDone = progress.status === 'ready';

                return (
                  <article
                    className={[
                      'flashcard',
                      `flashcard-${lens.id}`,
                      isFlipped ? 'is-flipped' : '',
                      isDone ? 'is-done' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={lens.id}
                  >
                    <div className="flashcard-inner">
                      <button
                        aria-expanded={isFlipped}
                        aria-controls={`flashcard-panel-${lens.id}`}
                        className="flashcard-front"
                        onClick={() => toggleCard(lens.id)}
                        ref={setFlashcardTriggerRef(lens.id)}
                        type="button"
                        tabIndex={isFlipped ? -1 : 0}
                      >
                        <div className="flashcard-front-top">
                          <h3>{lens.title}</h3>
                          <p>{lens.detail}</p>
                        </div>
                        <div className="flashcard-front-bottom">
                          <span className="flashcard-flip-hint">Flip</span>
                          {isDone ? (
                            <span className="flashcard-check" aria-label="Complete">
                              &#10003;
                            </span>
                          ) : null}
                        </div>
                      </button>

                      <section
                        aria-label={lens.title}
                        aria-hidden={!isFlipped}
                        className="flashcard-back"
                        id={`flashcard-panel-${lens.id}`}
                        inert={!isFlipped ? true : undefined}
                      >
                        <button
                          className="flashcard-close-btn"
                          onClick={() => toggleCard(lens.id)}
                          ref={setFlashcardCloseRef(lens.id)}
                          type="button"
                          aria-label="Flip back"
                        >
                          {'\u00D7'}
                        </button>

                        <h3 className="flashcard-question">{lens.transcriptPrompt}</h3>

                        <div className="ritual-transcript-header">
                          <button
                            className={
                              recordingLens === lens.id
                                ? 'button button-primary button-small ritual-record-button is-recording'
                                : 'button button-secondary button-small ritual-record-button'
                            }
                            onClick={() =>
                              recordingLens === lens.id ? stopRecording() : startRecording(lens.id)
                            }
                            type="button"
                          >
                            {recordingLens === lens.id ? 'Stop recording' : 'Record'}
                          </button>
                        </div>

                        {recordingLens === lens.id || transcripts[lens.id] ? (
                          <output aria-live="polite" className="ritual-transcript-status">
                            {transcriptStatus}
                          </output>
                        ) : null}

                        <label className="ritual-field">
                          <span>{lens.title} notes</span>
                          <textarea
                            onChange={(event) => updateTranscript(lens.id, event.target.value)}
                            placeholder="Paste notes or let live transcript fill this in."
                            ref={setFlashcardNotesRef(lens.id)}
                            value={transcripts[lens.id]}
                          />
                        </label>

                        <button
                          className={
                            isDone ? 'flashcard-complete-btn is-done' : 'flashcard-complete-btn'
                          }
                          onClick={() => {
                            if (!isDone) {
                              updateField(
                                mapping.currentKey,
                                setupInput[mapping.currentKey] || 'Captured',
                              );
                              updateField(
                                mapping.painKey,
                                setupInput[mapping.painKey] || 'Captured',
                              );
                              updateField(
                                mapping.improveKey,
                                setupInput[mapping.improveKey] || 'Captured',
                              );
                            }
                            toggleCard(lens.id);
                          }}
                          type="button"
                        >
                          {isDone ? '\u2713 Complete' : 'Mark complete'}
                        </button>
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>

            {allLensesReady ? (
              <div className="ritual-synthesis">
                <div className="section-heading">
                  <h3>Your setup packet is ready</h3>
                  <p className="lede">
                    All four lenses are captured. Name your coop and take the packet with you.
                  </p>
                </div>

                <div className="ritual-setup-grid">
                  <label className="ritual-field">
                    <span>Coop name</span>
                    <input
                      onChange={(event) => updateField('coopName', event.target.value)}
                      placeholder="Pocket Coop"
                      type="text"
                      value={setupInput.coopName}
                    />
                  </label>

                  <label className="ritual-field">
                    <span>What opportunity are you organizing around?</span>
                    <textarea
                      onChange={(event) => updateField('purpose', event.target.value)}
                      placeholder="Turn scattered knowledge into clearer coordination for the group."
                      value={setupInput.purpose}
                    />
                  </label>
                </div>

                <label className="ritual-field">
                  <span>Shared notes</span>
                  <textarea
                    onChange={(event) => setSharedNotes(event.target.value)}
                    placeholder="Paste meeting notes or additional context here."
                    value={sharedNotes}
                  />
                </label>

                <div className="prompt-shell ritual-packet-shell">
                  <div className="prompt-toolbar">
                    <div>
                      <strong>Setup packet</strong>
                      <div>All four cards are shaped and ready to hand off.</div>
                    </div>
                    <div className="cta-row packet-actions">
                      <button
                        className={
                          copyState === 'copied'
                            ? 'button button-primary button-small'
                            : 'button button-secondary button-small'
                        }
                        onClick={() => void copySetupNotes()}
                        type="button"
                      >
                        {copyState === 'copied'
                          ? 'Copied'
                          : copyState === 'failed'
                            ? 'Clipboard unavailable'
                            : 'Copy packet'}
                      </button>
                      <button
                        className="button button-secondary button-small"
                        onClick={downloadSetupNotes}
                        type="button"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <pre>{setupPacketText}</pre>
                </div>
              </div>
            ) : (
              <p className="ritual-progress-hint">
                {completedLensCount > 0
                  ? `${completedLensCount} of 4 lenses complete — flip and capture the rest.`
                  : 'Flip a card to start capturing.'}
              </p>
            )}
          </div>
        </section>

        <section className="journey-section arrival-journey" id="why-build" ref={arrivalJourneyRef}>
          <div
            aria-hidden="true"
            className={
              prefersReducedMotion
                ? 'journey-scene journey-scene-arrival is-static'
                : 'journey-scene journey-scene-arrival'
            }
          >
            <div className="journey-scene-inner">
              <div className="scene-stars" ref={arrivalStarsRef}>
                {Array.from({ length: STAR_COUNT }, (_, i) => (
                  <span className="scene-star" key={`star-${i}`} style={starStyle(i)} />
                ))}
              </div>
              <div className="scene-moon" ref={arrivalMoonRef} />
              <div className="scene-glow scene-glow-left" ref={arrivalGlowLeftRef} />
              <div className="scene-glow scene-glow-right" ref={arrivalGlowRightRef} />
              <div className="scene-cloud scene-cloud-center" ref={arrivalCloudRef} />
              <div className="scene-hill scene-hill-back" ref={arrivalHillBackRef} />
              <div className="scene-hill scene-hill-mid" ref={arrivalHillMidRef} />
              <div className="scene-hill scene-hill-front" ref={arrivalHillFrontRef} />
              <div className="scene-path scene-path-arrival" ref={arrivalPathRef} />

              <div className="scene-coop arrival-scene-coop" ref={arrivalCoopRef}>
                <CoopIllustration />
                <div className="scene-coop-glow" ref={arrivalCoopGlowRef}>
                  <div className="scene-coop-glow-window" />
                  <div className="scene-coop-glow-window" />
                  <div className="scene-coop-glow-door" />
                </div>
                <div className="scene-inside-flock" ref={arrivalInsideFlockRef}>
                  <span className="inside-bird inside-bird-a" />
                  <span className="inside-bird inside-bird-b" />
                  <span className="inside-bird inside-bird-c" />
                  <span className="inside-bird inside-bird-d" />
                </div>
              </div>

              {journeyChickens.map((chicken) => (
                <div
                  className={`scene-chicken scene-chicken-${chicken.id} scene-chicken-arrival`}
                  key={chicken.id}
                  ref={setArrivalChickenRef(chicken.id)}
                >
                  <ChickenSprite
                    label={chicken.label}
                    showLabel={false}
                    variant={chicken.variant}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="journey-panels">
            <div className="arrival-scroll-spacer" aria-hidden="true" />
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="resources">
        <div className="landing-footer-inner">
          <span className="footer-copy">&copy; {new Date().getFullYear()} Regen Coordination</span>
          <nav className="footer-links-row">
            <a
              href="https://github.com/regen-coordination/coop"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a href="https://docs.coop.town" target="_blank" rel="noopener noreferrer">
              Docs
            </a>
            <a href="https://bsky.app/profile/coop.town" target="_blank" rel="noopener noreferrer">
              Bluesky
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
