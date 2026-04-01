import type { SetupInsightsInput } from '@coop/shared';
import {
  clipboardPasteFallbackMessage,
  getRitualLenses,
  pasteClipboardText,
  synthesizeTranscriptsToPurpose,
} from '@coop/shared';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { DevTunnelBadge } from '../../components/DevTunnelBadge';
import { LanguageSelector } from '../../components/LanguageSelector';
import type { DevEnvironmentState } from '../../dev-environment';
import { useI18n } from '../../hooks/useI18n';
import { ChickenSprite, CoopIllustration } from './landing-animations';
import {
  LANDING_DRAFT_STORAGE_KEY,
  STAR_COUNT,
  arrivalChickenCommunities,
  arrivalFlightPaths,
  audienceOptions,
  audienceToSpaceType,
  buildLandingSetupPacket,
  buildPacketFilename,
  chickenThoughts,
  cleanText,
  cloneSetupInput,
  cloneTranscripts,
  compact,
  defaultTranscriptStatus,
  emptyLandingTranscripts,
  getLensProgress,
  howItWorksCards,
  initialsForName,
  journeyChickens,
  readLandingDraft,
  resolveSpeechError,
  resolveSpeechRecognitionConstructor,
  ritualCardMappings,
  starStyle,
  statusLabel,
  storyFlightPaths,
  teamMembers,
} from './landing-data';
import type {
  AudienceId,
  BrowserSpeechRecognition,
  LandingDraft,
  SetupFieldKey,
  TranscriptKey,
  TranscriptMap,
} from './landing-types';

export { buildLandingSetupPacket, emptyLandingTranscripts };

export function App({
  devEnvironment = null,
}: {
  devEnvironmentState?: DevEnvironmentState | null;
}) {
  const { t } = useI18n();
  const initialDraftRef = useRef<LandingDraft | null>(null);

  if (!initialDraftRef.current) {
    initialDraftRef.current = readLandingDraft();
  }

  const initialDraft = initialDraftRef.current;

  const landingRootRef = useRef<HTMLDivElement | null>(null);
  const storyJourneyRef = useRef<HTMLElement | null>(null);
  const arrivalJourneyRef = useRef<HTMLElement | null>(null);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const howItWorksRef = useRef<HTMLDivElement | null>(null);
  const ritualSectionRef = useRef<HTMLElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const recognitionHadErrorRef = useRef(false);
  const recognitionStoppedIntentionallyRef = useRef(false);
  const recognitionRestartCountRef = useRef(0);

  const storySunRef = useRef<HTMLDivElement | null>(null);
  const storyGlowLeftRef = useRef<HTMLDivElement | null>(null);
  const storyGlowRightRef = useRef<HTMLDivElement | null>(null);
  const storyCloudARef = useRef<HTMLDivElement | null>(null);
  const storyCloudBRef = useRef<HTMLDivElement | null>(null);
  const storyHillBackRef = useRef<HTMLDivElement | null>(null);
  const storyHillMidRef = useRef<HTMLDivElement | null>(null);
  const storyHillFrontRef = useRef<HTMLDivElement | null>(null);
  const storyPathRef = useRef<HTMLDivElement | null>(null);
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
  const arrivalNightSkyRef = useRef<HTMLDivElement | null>(null);
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
  const lastSynthesizedFromRef = useRef('');

  const [setupInput, setSetupInput] = useState<SetupInsightsInput>(() => initialDraft.setupInput);
  const [transcripts, setTranscripts] = useState<TranscriptMap>(() => initialDraft.transcripts);
  const [audience, setAudience] = useState<AudienceId>(() => initialDraft.audience);
  const [openCardId, setOpenCardId] = useState<TranscriptKey | null>(() => initialDraft.openCardId);
  const [sharedNotes, setSharedNotes] = useState(() => initialDraft.sharedNotes);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [recordingLens, setRecordingLens] = useState<TranscriptKey | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState(defaultTranscriptStatus);
  const [transcriptStatusCardId, setTranscriptStatusCardId] = useState<TranscriptKey | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [heroScrollHintOpacity, setHeroScrollHintOpacity] = useState(1);

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
  const allLensesReady = completedLensCount === ritualCardMappings.length;

  useEffect(() => {
    if (!allLensesReady || setupInput.purpose) {
      return;
    }
    const transcriptFingerprint = `${transcripts.capital}|${transcripts.impact}|${transcripts.governance}|${transcripts.knowledge}`;
    if (transcriptFingerprint === lastSynthesizedFromRef.current) {
      return;
    }
    lastSynthesizedFromRef.current = transcriptFingerprint;
    const synthesized = synthesizeTranscriptsToPurpose(transcripts);
    if (synthesized) {
      setSetupInput((current) => ({ ...current, purpose: synthesized }));
    }
  }, [allLensesReady, setupInput.purpose, transcripts]);

  const openCardIndex = openCardId ? ritualLenses.findIndex((lens) => lens.id === openCardId) : -1;
  const openCardLens = openCardIndex >= 0 ? ritualLenses[openCardIndex] : null;
  const openCardMapping = openCardIndex >= 0 ? ritualCardMappings[openCardIndex] : null;
  const openCardProgress = openCardIndex >= 0 ? lensProgress[openCardIndex] : null;

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
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;
    const updateHintOpacity = () => {
      const heroHeight = heroCopyRef.current?.offsetHeight ?? window.innerHeight * 0.25;
      const fadeDistance = Math.max(96, Math.min(window.innerHeight * 0.18, heroHeight * 0.5));
      const nextOpacity = Math.max(0, 1 - window.scrollY / fadeDistance);
      setHeroScrollHintOpacity((current) =>
        Math.abs(current - nextOpacity) < 0.01 ? current : nextOpacity,
      );
    };

    updateHintOpacity();

    const handleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHintOpacity);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
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
        const scrubEase = 'power1.inOut';

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
          const howItWorksCardElements = Array.from(
            howItWorksRef.current?.querySelectorAll<HTMLElement>('.how-works-card') ?? [],
          );
          const storySignalLabels = Array.from(
            scope.querySelectorAll<HTMLElement>('.journey-scene-story .scene-chicken-label'),
          );
          const whyBuildCard =
            arrivalJourneyRef.current?.querySelector<HTMLDivElement>('.why-build-heading-card') ??
            null;
          const whyBuildTeam =
            arrivalJourneyRef.current?.querySelector<HTMLDivElement>('.why-build-scene-team') ??
            null;
          const whyBuildTeamMembers = Array.from(
            whyBuildTeam?.querySelectorAll<HTMLElement>('.team-members-grid .scene-team-member') ??
              [],
          );

          const arrivalCoopParts = {
            roof: arrivalCoopRef.current?.querySelector('.coop-roof') ?? null,
            body: arrivalCoopRef.current?.querySelector('.coop-body') ?? null,
            frames: Array.from(
              arrivalCoopRef.current?.querySelectorAll(
                '.coop-window, .coop-door, .coop-slat, .coop-trim',
              ) ?? [],
            ),
          };
          const insideBirds = Array.from(
            arrivalInsideFlockRef.current?.querySelectorAll<HTMLElement>('.inside-bird') ?? [],
          );

          gsap.set(storyChickens, { transformOrigin: '50% 50%' });
          gsap.set(arrivalChickens, { transformOrigin: '50% 50%', opacity: 0.94 });
          gsap.set(compact([arrivalCoopParts.roof, arrivalCoopParts.body]), {
            transformOrigin: '50% 100%',
          });
          gsap.set(arrivalCoopParts.frames, { transformOrigin: '50% 50%' });
          gsap.set(howItWorksCardElements, { transformOrigin: '50% 50%' });
          gsap.set(insideBirds, { transformOrigin: '50% 100%' });
          gsap.set(arrivalMoonRef.current, { transformOrigin: '50% 50%' });

          const storyTimeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: storyJourneyRef.current,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.8,
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
              { x: '-3vw', y: '3vh', scaleX: 1.02 },
              { x: '8vw', y: '-5vh', scaleX: 1.1 },
              0,
            )
            .fromTo(
              storyHillMidRef.current,
              { x: '2vw', y: '1vh', scaleX: 1 },
              { x: '-9vw', y: '-6vh', scaleX: 1.1 },
              0,
            )
            .fromTo(
              storyHillFrontRef.current,
              { x: '-2vw', y: '1vh', scaleX: 1 },
              { x: '11vw', y: '-8vh', scaleX: 1.12 },
              0,
            )
            .fromTo(
              storyPathRef.current,
              { scaleX: 0.82, scaleY: 0.94, rotate: -10, opacity: 0.3 },
              { scaleX: 1.12, scaleY: 1.08, rotate: -4, opacity: 0.78 },
              0.12,
            )
            .fromTo(
              storySignalLabels,
              { autoAlpha: 0.18, y: 10, filter: 'blur(4px)' },
              { autoAlpha: 0.88, y: 0, filter: 'blur(0px)', stagger: 0.03 },
              0.06,
            )
            .fromTo(heroCopyRef.current, { autoAlpha: 1, y: 0 }, { autoAlpha: 0.12, y: -18 }, 0.42)
            .fromTo(
              howItWorksRef.current,
              { autoAlpha: 0.12, y: 28, scale: 0.975 },
              { autoAlpha: 1, y: 0, scale: 1 },
              0.24,
            )
            .fromTo(howItWorksHeading, { autoAlpha: 0.42, y: 20 }, { autoAlpha: 1, y: 0 }, 0.29)
            .fromTo(
              howItWorksCardElements,
              {
                autoAlpha: 0.18,
                y: 22,
                scale: 0.98,
              },
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                stagger: 0.08,
              },
              0.34,
            );

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
              scrub: 0.8,
            },
          });

          // Heading card and team already visible at start (no fade-in animation)
          // They stay visible through mid-scroll, then fade out as the coop house rises
          arrivalTimeline
            .set(whyBuildCard, { autoAlpha: 1, y: 0 }, 0)
            .set(whyBuildTeam, { autoAlpha: 1, y: 0 }, 0)
            .set(whyBuildTeamMembers, { autoAlpha: 1, scale: 1 }, 0)
            .to(whyBuildCard, { autoAlpha: 0, y: -20, scale: 0.96 }, 0.32)
            .to(whyBuildTeam, { autoAlpha: 0, y: -14 }, 0.34)
            .to(whyBuildTeamMembers, { autoAlpha: 0, y: -10, stagger: 0.02 }, 0.36)
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
              0.08,
            )
            .fromTo(
              arrivalCoopParts.roof,
              { y: -86, scaleX: 0.78, autoAlpha: 0 },
              { y: 0, scaleX: 1, autoAlpha: 1 },
              0.16,
            )
            .fromTo(
              arrivalCoopParts.frames,
              { y: 18, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, stagger: 0.04 },
              0.22,
            )
            .fromTo(
              arrivalInsideFlockRef.current,
              { autoAlpha: 0, y: 18, scale: 0.94 },
              { autoAlpha: 1, y: 0, scale: 1 },
              0.54,
            )
            .fromTo(
              insideBirds,
              { autoAlpha: 0, y: 18, scale: 0.82 },
              { autoAlpha: 1, y: 0, scale: 1, stagger: 0.04 },
              0.58,
            );
          arrivalTimeline
            .fromTo(arrivalNightSkyRef.current, { opacity: 0 }, { opacity: 0.92 }, 0.4)
            .fromTo(arrivalStarsRef.current, { opacity: 0 }, { opacity: 0.78 }, 0.5)
            .fromTo(
              arrivalMoonRef.current,
              { opacity: 0, y: 24, scale: 0.82 },
              { opacity: 0.96, y: 0, scale: 1, ease: scrubEase },
              0.62,
            )
            // Warm halo fades in as coop rises
            .fromTo(
              '.scene-coop-halo',
              { opacity: 0, scale: 0.6 },
              { opacity: 1, scale: 1.1 },
              0.16,
            )
            // Door glow flickers on before chickens arrive — cinematic "coming home"
            .fromTo(arrivalCoopGlowRef.current, { opacity: 0 }, { opacity: 0.3 }, 0.25)
            .to(arrivalCoopGlowRef.current, { opacity: 0.15 }, 0.3)
            .to(arrivalCoopGlowRef.current, { opacity: 0.5 }, 0.34)
            .to(arrivalCoopGlowRef.current, { opacity: 1 }, 0.48)
            .to(arrivalCloudRef.current, { opacity: 0.14 }, 0.38);

          // Stagger chicken arrivals — procession walking toward the coop door.
          // Start at 0.05 so they begin moving almost immediately as the section
          // enters, and spread over a tight range so the walk is clearly visible.
          for (let i = 0; i < journeyChickens.length; i++) {
            const chicken = journeyChickens[i];
            const node = arrivalChickenRefs.current[chicken.id];
            const path = arrivalFlightPaths[chicken.id];

            if (!node || !path) {
              continue;
            }

            const staggerDelay = 0.05 + i * 0.02;

            arrivalTimeline.to(
              node,
              {
                ease: scrubEase,
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
    if (typeof window === 'undefined' || !openCardId) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      focusReturnCardRef.current = openCardId;
      const recognition = recognitionRef.current;

      if (recognition) {
        if (recognition.abort) {
          recognition.abort();
        } else {
          recognition.stop();
        }
        recognitionRef.current = null;
        setRecordingLens(null);
      }

      setOpenCardId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCardId]);

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

  function setScopedTranscriptStatus(cardId: TranscriptKey, message: string) {
    setTranscriptStatus(message);
    setTranscriptStatusCardId(cardId);
  }

  function stopRecognitionNow() {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    recognitionStoppedIntentionallyRef.current = true;

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

    recognitionStoppedIntentionallyRef.current = true;
    const lensTitle = ritualLenses.find((l) => l.id === recordingLens)?.title ?? recordingLens;
    setScopedTranscriptStatus(recordingLens, `Saving the ${lensTitle.toLowerCase()} notes...`);
    recognitionRef.current.stop();
  }

  function startRecording(cardId: TranscriptKey) {
    if (!speechRecognition) {
      setScopedTranscriptStatus(
        cardId,
        'This browser does not expose live transcript here yet. Type notes directly into the card.',
      );
      return;
    }

    if (recognitionRef.current) {
      stopRecognitionNow();
    }

    recognitionHadErrorRef.current = false;
    recognitionStoppedIntentionallyRef.current = false;
    recognitionRestartCountRef.current = 0;

    const recognition = new speechRecognition();
    let committedTranscript = cleanText(transcripts[cardId]);

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setRecordingLens(cardId);
      const lensTitle = ritualLenses.find((l) => l.id === cardId)?.title ?? cardId;
      setScopedTranscriptStatus(cardId, `${lensTitle} is listening on this device.`);
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
      setScopedTranscriptStatus(cardId, resolveSpeechError(event.error));
    };

    recognition.onend = () => {
      if (recognitionHadErrorRef.current) {
        setRecordingLens((current) => (current === cardId ? null : current));
        recognitionRef.current = null;
        return;
      }

      // Auto-restart if the browser stopped recognition unexpectedly (e.g. silence timeout)
      if (
        !recognitionStoppedIntentionallyRef.current &&
        speechRecognition &&
        recognitionRestartCountRef.current < 3
      ) {
        recognitionRestartCountRef.current += 1;
        try {
          const restartRecognition = new speechRecognition();
          restartRecognition.continuous = true;
          restartRecognition.interimResults = true;
          restartRecognition.lang = 'en-US';
          restartRecognition.onstart = recognition.onstart;
          restartRecognition.onresult = recognition.onresult;
          restartRecognition.onerror = recognition.onerror;
          restartRecognition.onend = recognition.onend;
          recognitionRef.current = restartRecognition;
          restartRecognition.start();
          return;
        } catch {
          // Fall through to normal cleanup if restart fails
        }
      }

      setRecordingLens((current) => (current === cardId ? null : current));
      recognitionRef.current = null;

      const endTitle = ritualLenses.find((l) => l.id === cardId)?.title ?? cardId;
      if (!recognitionStoppedIntentionallyRef.current && recognitionRestartCountRef.current >= 3) {
        setScopedTranscriptStatus(cardId, 'Recording paused \u2014 tap Record to try again');
      } else {
        setScopedTranscriptStatus(cardId, `${endTitle} transcript is ready to edit.`);
      }
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

  function closeOpenCard() {
    if (!openCardId) {
      return;
    }

    focusReturnCardRef.current = openCardId;
    stopRecognitionNow();
    setOpenCardId(null);
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
    setTranscriptStatusCardId(null);
    setCopyState('idle');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LANDING_DRAFT_STORAGE_KEY);
    }
  }

  function renderOpenCardStage() {
    if (!openCardLens || !openCardMapping || !openCardProgress) {
      return null;
    }

    const isDone = openCardProgress.status === 'ready';
    const isLeftColumn = openCardIndex % 2 === 0;
    const isTopRow = openCardIndex < 2;
    const stageStyle = {
      '--flashcard-pickup-x': isLeftColumn ? '-2.35rem' : '2.35rem',
      '--flashcard-pickup-y': isTopRow ? '-1.1rem' : '1.1rem',
      '--flashcard-pickup-tilt': isLeftColumn ? '-2deg' : '2deg',
      '--flashcard-pickup-settle-tilt': isLeftColumn ? '0.35deg' : '-0.35deg',
    } as CSSProperties;

    return (
      <dialog
        aria-label={openCardLens.title}
        aria-modal="false"
        className={`flashcard-stage flashcard-${openCardLens.id}${isDone ? ' is-done' : ''}`}
        id={`flashcard-panel-${openCardLens.id}`}
        open
        style={stageStyle}
      >
        <div className="flashcard-stage-header">
          <div className="flashcard-front-meta">
            <span className="flashcard-number">
              {t('ritual.lens')} {openCardIndex + 1}
            </span>
            <span className={`flashcard-status-pill is-${openCardProgress.status}`}>
              {statusLabel(openCardProgress.status, t)}
            </span>
          </div>
          <button
            className="flashcard-close-btn"
            onClick={closeOpenCard}
            ref={setFlashcardCloseRef(openCardLens.id)}
            type="button"
            aria-label={t('ritual.closeCardLabel')}
          >
            {'\u00D7'}
          </button>
        </div>

        <div className="flashcard-stage-copy">
          <p className="flashcard-stage-label">{openCardLens.title}</p>
          <h3 className="flashcard-question">{openCardLens.transcriptPrompt}</h3>
          <p className="flashcard-detail">{openCardLens.detail}</p>
        </div>

        <div className="flashcard-stage-actions">
          <button
            className={
              recordingLens === openCardLens.id
                ? 'button button-primary button-small ritual-record-button is-recording'
                : 'button button-secondary button-small ritual-record-button'
            }
            onClick={() =>
              recordingLens === openCardLens.id ? stopRecording() : startRecording(openCardLens.id)
            }
            type="button"
          >
            <span className="record-dot" aria-hidden="true" />
            {recordingLens === openCardLens.id
              ? t('ritual.stopRecordButton')
              : t('ritual.recordButton')}
          </button>

          <button
            className="button button-secondary button-small"
            onClick={async () => {
              const result = await pasteClipboardText({
                currentValue: transcripts[openCardLens.id],
                mode: 'append',
              });
              if (result.status === 'success') {
                updateTranscript(openCardLens.id, result.value);
                return;
              }
              if (result.status === 'unavailable') {
                setScopedTranscriptStatus(openCardLens.id, clipboardPasteFallbackMessage);
              }
            }}
            type="button"
          >
            {t('ritual.pasteButton')}
          </button>
        </div>

        {recordingLens === openCardLens.id ||
        transcripts[openCardLens.id] ||
        (transcriptStatusCardId === openCardLens.id &&
          transcriptStatus !== defaultTranscriptStatus) ? (
          <output aria-live="polite" className="ritual-transcript-status">
            {transcriptStatus}
          </output>
        ) : null}

        <label className="ritual-field flashcard-notes-field">
          <span className="sr-only">
            {openCardLens.title} {t('ritual.notesSrLabel')}
          </span>
          <textarea
            aria-label={`${openCardLens.title} ${t('ritual.notesSrLabel')}`}
            onChange={(event) => updateTranscript(openCardLens.id, event.target.value)}
            placeholder={t('ritual.notesPlaceholder')}
            ref={setFlashcardNotesRef(openCardLens.id)}
            value={transcripts[openCardLens.id]}
          />
        </label>

        <div className="flashcard-stage-footer">
          <p className="flashcard-stage-footnote">
            {isDone ? t('ritual.readyMessage') : t('ritual.captureMessage')}
          </p>
          <button
            className={isDone ? 'flashcard-complete-btn is-done' : 'flashcard-complete-btn'}
            onClick={() => {
              if (!isDone) {
                updateField(
                  openCardMapping.currentKey,
                  setupInput[openCardMapping.currentKey] || 'Captured',
                );
                updateField(
                  openCardMapping.painKey,
                  setupInput[openCardMapping.painKey] || 'Captured',
                );
                updateField(
                  openCardMapping.improveKey,
                  setupInput[openCardMapping.improveKey] || 'Captured',
                );
              }
              toggleCard(openCardLens.id);
            }}
            type="button"
          >
            {isDone ? t('ritual.completeButton') : t('ritual.markCompleteButton')}
          </button>
        </div>
      </dialog>
    );
  }

  return (
    <div className="page-shell landing-shell" ref={landingRootRef}>
      <div className="backdrop landing-backdrop" />

      <LanguageSelector />

      <header className="landing-topbar">
        <div className="topbar">
          <a aria-label={t('hero.logoLabel')} className="hero-logo" href="#meadow">
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
            <div className="journey-scene-bg">
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
              <div className="scene-feed-spot scene-feed-spot-a" />
              <div className="scene-feed-spot scene-feed-spot-b" />
            </div>
            <div className="journey-scene-inner">
              {journeyChickens.map((chicken) => (
                <div
                  className={`scene-chicken scene-chicken-${chicken.id}`}
                  data-facing={chicken.facing ?? 'right'}
                  key={chicken.id}
                  ref={setStoryChickenRef(chicken.id)}
                >
                  <div className="thought-bubble" aria-hidden="true">
                    <span className="thought-kicker">
                      {t(`chickenThoughts.${chicken.id}.kicker`)}
                    </span>
                    <span className="thought-text">{t(`chickenThoughts.${chicken.id}.text`)}</span>
                  </div>
                  <ChickenSprite
                    color={chicken.color}
                    facing={chicken.facing}
                    label={chicken.labelKey ? t(chicken.labelKey) : chicken.label}
                    showLabel={true}
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
                    <span className="hero-title-line">No more</span>
                    <span className="hero-title-line hero-title-line-bottom">chickens loose.</span>
                  </h1>
                  <p className="hero-subtitle">Turning knowledge into opportunity.</p>
                  <p className="sr-only">
                    Eight chickens start apart in the meadow and converge as you scroll.
                  </p>
                </div>

                {/* Signal info is now merged into chicken thought bubbles */}

                <div
                  className={`hero-scroll-hint${heroScrollHintOpacity < 0.04 ? ' is-hidden' : ''}`}
                  aria-hidden="true"
                  style={{ opacity: heroScrollHintOpacity }}
                >
                  <svg
                    className="hero-scroll-arrow"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    role="img"
                    aria-label={t('hero.scrollHint')}
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
                  <h2>{t('how_works.heading')}</h2>
                  <p className="lede">{t('how_works.description')}</p>
                </div>

                <div className="how-works-grid">
                  {howItWorksCards.map((card, index) => (
                    <article className="how-works-card nest-card" key={card.title}>
                      <span aria-hidden="true" className="how-works-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="how-works-card-copy">
                        <h3>{t(`how_works.card${index + 1}.title`)}</h3>
                        <p>{t(`how_works.card${index + 1}.detail`)}</p>
                      </div>
                      <div className="how-works-thought-bubble" aria-hidden="true">
                        <div className="thought-bubble-inner">
                          <span className="thought-bubble-emoji">🐔</span>
                        </div>
                        <div className="thought-bubble-pointer" />
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
            <h2>{t('ritual.heading')}</h2>
            <p className="lede ritual-section-copy">{t('ritual.description')}</p>
          </div>

          <div className="ritual-game-shell nest-card" data-audience={audience}>
            <div className="ritual-toolbar">
              <div className="audience-picker">
                <div className="audience-chip-group">
                  {audienceOptions.map((option) => (
                    <button
                      aria-pressed={option.id === audience}
                      className={
                        option.id === audience ? 'audience-chip is-active' : 'audience-chip'
                      }
                      data-audience-option={option.id}
                      key={option.id}
                      onClick={() => setAudience(option.id)}
                      title={t(`audience.${option.id}Tone`)}
                      type="button"
                    >
                      {t(`audience.${option.id}`)}
                    </button>
                  ))}
                </div>
              </div>

              <span className="ritual-local-badge" aria-label={t('ritual.localBadgeLabel')}>
                <svg
                  aria-hidden="true"
                  className="ritual-local-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 1C5.8 1 4 2.8 4 5v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5c0-2.2-1.8-4-4-4Zm0 1.5A2.5 2.5 0 0 1 10.5 5v2h-5V5A2.5 2.5 0 0 1 8 2.5Z"
                    fill="currentColor"
                  />
                </svg>
                {t('ritual.localBadgeLabel')}
              </span>

              <button
                className="button button-secondary button-small ritual-reset-inline"
                onClick={resetRitual}
                type="button"
              >
                {t('ritual.resetButton')}
              </button>
            </div>

            <div className={`flashcard-deck${openCardLens ? ' has-open-card' : ''}`}>
              <div className={`flashcard-focus-shell${openCardLens ? ' is-active' : ''}`}>
                {openCardLens ? (
                  <button
                    aria-label={t('ritual.closeCardBackdrop')}
                    className="flashcard-focus-backdrop"
                    onClick={closeOpenCard}
                    type="button"
                  />
                ) : null}
                {renderOpenCardStage()}
              </div>

              <div className="flashcard-grid">
                {ritualLenses.map((lens, index) => {
                  const progress = lensProgress[index];
                  const isOpen = openCardId === lens.id;
                  const isDone = progress.status === 'ready';
                  const isMuted = openCardId !== null && openCardId !== lens.id;

                  return (
                    <article
                      className={[
                        'flashcard',
                        `flashcard-${lens.id}`,
                        isOpen ? 'is-open-source' : '',
                        isMuted ? 'is-muted' : '',
                        isDone ? 'is-done' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={lens.id}
                    >
                      <button
                        aria-controls={`flashcard-panel-${lens.id}`}
                        aria-expanded={isOpen}
                        aria-haspopup="dialog"
                        className="flashcard-front"
                        onClick={() => toggleCard(lens.id)}
                        ref={setFlashcardTriggerRef(lens.id)}
                        type="button"
                      >
                        <div className="flashcard-front-top">
                          <div className="flashcard-front-meta">
                            <span className="flashcard-number">
                              {t('ritual.lens')} {index + 1}
                            </span>
                            <span className={`flashcard-status-pill is-${progress.status}`}>
                              {statusLabel(progress.status, t)}
                            </span>
                          </div>
                          <h3>{lens.title}</h3>
                          <p>{lens.detail}</p>
                        </div>

                        <div className="flashcard-front-bottom">
                          {isDone ? (
                            <span
                              className="flashcard-check"
                              aria-label={t('ritual.completeCheckmark')}
                            >
                              &#10003;
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>

            {allLensesReady ? (
              <div className="ritual-synthesis">
                <div className="section-heading">
                  <h3>{t('ritual.setupPacketReady')}</h3>
                  <p className="lede">{t('ritual.setupPacketReadyDesc')}</p>
                </div>

                <div className="ritual-setup-grid">
                  <label className="ritual-field">
                    <span>{t('ritual.coopNameLabel')}</span>
                    <input
                      onChange={(event) => updateField('coopName', event.target.value)}
                      placeholder={t('ritual.coopNamePlaceholder')}
                      type="text"
                      value={setupInput.coopName}
                    />
                  </label>

                  <label className="ritual-field">
                    <span>{t('ritual.purposeLabel')}</span>
                    <textarea
                      onChange={(event) => updateField('purpose', event.target.value)}
                      placeholder={t('ritual.purposePlaceholder')}
                      value={setupInput.purpose}
                    />
                  </label>
                </div>

                <label className="ritual-field">
                  <span>{t('ritual.sharedNotesLabel')}</span>
                  <textarea
                    onChange={(event) => setSharedNotes(event.target.value)}
                    placeholder={t('ritual.sharedNotesPlaceholder')}
                    value={sharedNotes}
                  />
                </label>

                <div className="prompt-shell ritual-packet-shell">
                  <div className="prompt-toolbar">
                    <div>
                      <strong>{t('ritual.setupPacketLabel')}</strong>
                      <div>{t('ritual.setupPacketDesc')}</div>
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
                          ? t('ritual.copiedButton')
                          : copyState === 'failed'
                            ? t('ritual.clipboardUnavailableButton')
                            : t('ritual.copyPacketButton')}
                      </button>
                      <button
                        className="button button-secondary button-small"
                        onClick={downloadSetupNotes}
                        type="button"
                      >
                        {t('ritual.downloadButton')}
                      </button>
                    </div>
                  </div>
                  <pre>{setupPacketText}</pre>
                </div>
              </div>
            ) : (
              <p className="ritual-progress-hint">
                {completedLensCount > 0
                  ? `${completedLensCount} ${t('ritual.progressPartial')}`
                  : t('ritual.progressStart')}
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
            <div className="journey-scene-bg">
              <div className="scene-night-sky" ref={arrivalNightSkyRef} />
              <div className="scene-stars" ref={arrivalStarsRef}>
                {Array.from({ length: STAR_COUNT }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static decorative stars never reorder
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
            </div>
            <div className="journey-scene-inner">
              <div className="scene-coop arrival-scene-coop" ref={arrivalCoopRef}>
                <div className="scene-coop-halo" />
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
                  <span className="inside-bird inside-bird-e" />
                </div>
              </div>

              {journeyChickens.map((chicken) => {
                const communityLabel = arrivalChickenCommunities[chicken.id];
                return (
                  <div
                    className={`scene-chicken scene-chicken-${chicken.id} scene-chicken-arrival`}
                    key={chicken.id}
                    ref={setArrivalChickenRef(chicken.id)}
                  >
                    <ChickenSprite
                      color={chicken.color}
                      facing={chicken.facing}
                      label={
                        communityLabel ?? (chicken.labelKey ? t(chicken.labelKey) : chicken.label)
                      }
                      showLabel={!!communityLabel}
                      variant={chicken.variant}
                    />
                  </div>
                );
              })}

              <div className="why-build-heading-card">
                <h2>{t('why_build.heading')}</h2>
                <p className="lede">{t('why_build.description')}</p>
              </div>

              <div className="why-build-scene-team" aria-label={t('why_build.builtByTeam')}>
                <span className="scene-team-label">{t('why_build.builtByTeam')}</span>
                <div className="team-members-grid">
                  {teamMembers.map((member) => (
                    <div className="scene-team-member" key={member}>
                      <span className="team-avatar">{initialsForName(member)}</span>
                      <span className="scene-team-name">{member}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="journey-panels">
            <article className="journey-panel why-build-panel" />
            <div className="arrival-scroll-spacer" aria-hidden="true" />
          </div>
        </section>
      </main>

      <footer className="landing-footer" id="resources">
        <div className="landing-footer-inner">
          <span className="footer-copy">&copy; {new Date().getFullYear()} Greenpill Dev Guild</span>
          <nav className="footer-links-row">
            <a
              href="https://github.com/greenpill-dev-guild/coop"
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
