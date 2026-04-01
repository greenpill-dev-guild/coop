import type { SetupInsightsInput } from '@coop/shared';

export type TranscriptKey = 'capital' | 'impact' | 'governance' | 'knowledge';
export type TranscriptMap = Record<TranscriptKey, string>;
export type SetupFieldKey = keyof SetupInsightsInput;
export type LensStatus = 'empty' | 'drafting' | 'ready';
export type AudienceId = 'persona' | 'family' | 'friends' | 'community';

export type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

export type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};

export type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

export type SpeechRecognitionErrorLike = {
  error?: string;
};

export type BrowserSpeechRecognition = {
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

export type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

export type ChickenVariant = 'adult' | 'young' | 'chick';
export type ChickenFacing = 'left' | 'right';
export type ChickenColor = 'classic' | 'russet' | 'slate' | 'golden' | 'plum';

export type JourneyChicken = {
  id: string;
  label: string;
  labelKey?: string;
  variant?: ChickenVariant;
  facing?: ChickenFacing;
  color?: ChickenColor;
};

export type RitualCardMapping = {
  id: TranscriptKey;
  currentKey: SetupFieldKey;
  painKey: SetupFieldKey;
  improveKey: SetupFieldKey;
};

export type LensProgress = {
  captureReady: boolean;
  distillReady: boolean;
  status: LensStatus;
  filledCount: number;
};

export type LandingDraft = {
  version: number;
  audience: AudienceId;
  openCardId: TranscriptKey | null;
  sharedNotes: string;
  setupInput: SetupInsightsInput;
  transcripts: TranscriptMap;
};

export type LandingPacketOptions = {
  audience?: AudienceId;
  sharedNotes?: string;
};

export type AudienceOption = {
  id: AudienceId;
  label: string;
  accent: string;
  tone: string;
};

export type StoryCard = {
  title: string;
  detail: string;
};
