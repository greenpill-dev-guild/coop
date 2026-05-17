import type { SetupInsightsInput } from '@coop/shared/app';
import { getRitualLenses, synthesizeTranscriptsToPurpose } from '@coop/shared/app';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelector } from '../../components/LanguageSelector';
import type { DevEnvironmentState } from '../../dev-environment';
import { I18nProvider, useI18n } from '../../hooks/useI18n';
import { PublicInstallAction } from './PublicInstallAction';
import { useSpeechCapture } from './hooks/useSpeechCapture';
import {
  LANDING_DRAFT_STORAGE_KEY,
  arrivalFlightPaths,
  audienceToSpaceType,
  buildLandingSetupPacket,
  buildPacketFilename,
  cloneSetupInput,
  cloneTranscripts,
  compact,
  emptyLandingTranscripts,
  getLensProgress,
  journeyChickens,
  readLandingDraft,
  ritualCardMappings,
  storyFlightPaths,
} from './landing-data';
import type {
  AudienceId,
  LandingDraft,
  SetupFieldKey,
  TranscriptKey,
  TranscriptMap,
} from './landing-types';
import { ArrivalJourneySection } from './sections/ArrivalJourneySection';
import { RitualSection } from './sections/RitualSection';
import { StoryJourneySection } from './sections/StoryJourneySection';

export { buildLandingSetupPacket, emptyLandingTranscripts };

type LandingAppProps = {
  devEnvironment?: DevEnvironmentState | null;
  devEnvironmentState?: DevEnvironmentState | null;
};

function LandingPageContent({
  devEnvironmentState = null,
}: {
  devEnvironmentState?: DevEnvironmentState | null;
}) {
  const { t } = useI18n();
  const initialDraftRef = useRef<LandingDraft | null>(null);

  if (!initialDraftRef.current) {
    initialDraftRef.current = readLandingDraft();
  }

  const initialDraft = initialDraftRef.current;

  // ── Layout refs (used by GSAP animation setup) ──────────────────────
  const landingRootRef = useRef<HTMLDivElement | null>(null);
  const storyJourneyRef = useRef<HTMLElement | null>(null);
  const arrivalJourneyRef = useRef<HTMLElement | null>(null);
  const heroCopyRef = useRef<HTMLDivElement | null>(null);
  const howItWorksRef = useRef<HTMLDivElement | null>(null);
  const ritualSectionRef = useRef<HTMLElement | null>(null);

  // ── Story scene refs ────────────────────────────────────────────────
  const storySunRef = useRef<HTMLDivElement | null>(null);
  const storyGlowLeftRef = useRef<HTMLDivElement | null>(null);
  const storyGlowRightRef = useRef<HTMLDivElement | null>(null);
  const storyCloudARef = useRef<HTMLDivElement | null>(null);
  const storyCloudBRef = useRef<HTMLDivElement | null>(null);
  const storyHillBackRef = useRef<HTMLDivElement | null>(null);
  const storyHillMidRef = useRef<HTMLDivElement | null>(null);
  const storyHillFrontRef = useRef<HTMLDivElement | null>(null);
  const storyPathRef = useRef<HTMLDivElement | null>(null);
  const storySkyOverlayRef = useRef<HTMLDivElement | null>(null);
  const storySunWarmRef = useRef<HTMLDivElement | null>(null);
  const storyChickenRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Arrival scene refs ──────────────────────────────────────────────
  const arrivalGlowLeftRef = useRef<HTMLDivElement | null>(null);
  const arrivalGlowRightRef = useRef<HTMLDivElement | null>(null);
  const arrivalCloudRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillBackRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillMidRef = useRef<HTMLDivElement | null>(null);
  const arrivalHillFrontRef = useRef<HTMLDivElement | null>(null);
  const arrivalPathRef = useRef<HTMLDivElement | null>(null);
  const arrivalCoopRef = useRef<HTMLDivElement | null>(null);
  const arrivalInsideFlockRef = useRef<HTMLDivElement | null>(null);
  const arrivalNightSkyRef = useRef<HTMLDivElement | null>(null);
  const arrivalStarsRef = useRef<HTMLDivElement | null>(null);
  const arrivalMoonRef = useRef<HTMLDivElement | null>(null);
  const arrivalCoopGlowRef = useRef<HTMLDivElement | null>(null);
  const arrivalChickenRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Ritual flashcard refs ───────────────────────────────────────────
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

  // ── State ───────────────────────────────────────────────────────────
  const [setupInput, setSetupInput] = useState<SetupInsightsInput>(() => initialDraft.setupInput);
  const [transcripts, setTranscripts] = useState<TranscriptMap>(() => initialDraft.transcripts);
  const [audience, setAudience] = useState<AudienceId>(() => initialDraft.audience);
  const [openCardId, setOpenCardId] = useState<TranscriptKey | null>(() => initialDraft.openCardId);
  const [sharedNotes, setSharedNotes] = useState(() => initialDraft.sharedNotes);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [heroScrollHintOpacity, setHeroScrollHintOpacity] = useState(1);

  // ── Derived values ──────────────────────────────────────────────────
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

  // ── Speech capture hook ─────────────────────────────────────────────
  function updateTranscript(key: TranscriptKey, value: string) {
    setTranscripts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const speech = useSpeechCapture(transcripts, updateTranscript, ritualLenses);
  const stopRecognitionNow = speech.stopRecognitionNow;

  // ── Auto-synthesize purpose from transcripts ────────────────────────
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

  // ── Reduced motion preference ───────────────────────────────────────
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

  // ── Persist draft to localStorage ───────────────────────────────────
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

  // ── Hero scroll-hint fade ───────────────────────────────────────────
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

  // ── GSAP scroll-driven animations ──────────────────────────────────
  useEffect(() => {
    const isTestEnvironment =
      import.meta.env.MODE === 'test' ||
      (typeof navigator !== 'undefined' && /jsdom|happy-dom/i.test(navigator.userAgent));

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
            .fromTo(howItWorksRef.current, { y: 28, scale: 0.975 }, { y: 0, scale: 1 }, 0.24)
            .fromTo(howItWorksHeading, { y: 20 }, { y: 0 }, 0.29)
            .fromTo(
              howItWorksCardElements,
              {
                y: 22,
                scale: 0.98,
              },
              {
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
            .fromTo(
              '.scene-coop-halo',
              { opacity: 0, scale: 0.6 },
              { opacity: 1, scale: 1.1 },
              0.16,
            )
            .fromTo(arrivalCoopGlowRef.current, { opacity: 0 }, { opacity: 0.3 }, 0.25)
            .to(arrivalCoopGlowRef.current, { opacity: 0.15 }, 0.3)
            .to(arrivalCoopGlowRef.current, { opacity: 0.5 }, 0.34)
            .to(arrivalCoopGlowRef.current, { opacity: 1 }, 0.48)
            .to(arrivalCloudRef.current, { opacity: 0.14 }, 0.38);

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

  // ── Escape key closes open flashcard ────────────────────────────────
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
      stopRecognitionNow();
      setOpenCardId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCardId, stopRecognitionNow]);

  // ── Focus management for flashcard open/close ───────────────────────
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

  // ── Callbacks ───────────────────────────────────────────────────────
  function updateField(key: SetupFieldKey, value: string) {
    setSetupInput((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleCard(cardId: TranscriptKey) {
    if (speech.recordingLens && speech.recordingLens !== cardId) {
      speech.stopRecording();
    }

    if (speech.recordingLens === cardId) {
      speech.stopRecording();
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
    speech.stopRecognitionNow();
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
    speech.resetSpeechState();
    setSetupInput(cloneSetupInput());
    setTranscripts(cloneTranscripts());
    setAudience('community');
    setOpenCardId(null);
    setSharedNotes('');
    setCopyState('idle');

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LANDING_DRAFT_STORAGE_KEY);
    }
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
          <PublicInstallAction>
            {({ label, href, onClick, action }) => (
              <a
                className="button button-primary landing-install-action"
                data-install-action={action}
                data-qa="public-install-action"
                href={href}
                onClick={onClick}
              >
                {label}
              </a>
            )}
          </PublicInstallAction>
        </div>
      </header>

      <main className="landing-main">
        <StoryJourneySection
          storyJourneyRef={storyJourneyRef}
          prefersReducedMotion={prefersReducedMotion}
          storySkyOverlayRef={storySkyOverlayRef}
          storyGlowLeftRef={storyGlowLeftRef}
          storyGlowRightRef={storyGlowRightRef}
          storySunRef={storySunRef}
          storySunWarmRef={storySunWarmRef}
          storyCloudARef={storyCloudARef}
          storyCloudBRef={storyCloudBRef}
          storyHillBackRef={storyHillBackRef}
          storyHillMidRef={storyHillMidRef}
          storyHillFrontRef={storyHillFrontRef}
          storyPathRef={storyPathRef}
          storyChickenRefs={storyChickenRefs}
          heroCopyRef={heroCopyRef}
          howItWorksRef={howItWorksRef}
          heroScrollHintOpacity={heroScrollHintOpacity}
          devEnvironmentState={devEnvironmentState}
          installAction={
            <PublicInstallAction mobileOnly>
              {({ label, href, onClick, action }) => (
                <a
                  className="button button-primary hero-cta-primary hero-install-cta"
                  data-install-action={action}
                  data-qa="public-hero-install-action"
                  href={href}
                  onClick={onClick}
                >
                  {label}
                </a>
              )}
            </PublicInstallAction>
          }
        />

        <RitualSection
          ritualSectionRef={ritualSectionRef}
          setupInput={setupInput}
          transcripts={transcripts}
          audience={audience}
          openCardId={openCardId}
          sharedNotes={sharedNotes}
          copyState={copyState}
          recordingLens={speech.recordingLens}
          transcriptStatus={speech.transcriptStatus}
          transcriptStatusCardId={speech.transcriptStatusCardId}
          ritualLenses={ritualLenses}
          lensProgress={lensProgress}
          allLensesReady={allLensesReady}
          completedLensCount={completedLensCount}
          setupPacketText={setupPacketText}
          flashcardTriggerRefs={flashcardTriggerRefs}
          flashcardCloseRefs={flashcardCloseRefs}
          flashcardNotesRefs={flashcardNotesRefs}
          setAudience={setAudience}
          setSharedNotes={setSharedNotes}
          updateField={updateField}
          updateTranscript={updateTranscript}
          toggleCard={toggleCard}
          closeOpenCard={closeOpenCard}
          resetRitual={resetRitual}
          copySetupNotes={copySetupNotes}
          downloadSetupNotes={downloadSetupNotes}
          startRecording={speech.startRecording}
          stopRecording={speech.stopRecording}
          setScopedTranscriptStatus={speech.setScopedTranscriptStatus}
        />

        <ArrivalJourneySection
          arrivalJourneyRef={arrivalJourneyRef}
          prefersReducedMotion={prefersReducedMotion}
          arrivalNightSkyRef={arrivalNightSkyRef}
          arrivalStarsRef={arrivalStarsRef}
          arrivalMoonRef={arrivalMoonRef}
          arrivalGlowLeftRef={arrivalGlowLeftRef}
          arrivalGlowRightRef={arrivalGlowRightRef}
          arrivalCloudRef={arrivalCloudRef}
          arrivalHillBackRef={arrivalHillBackRef}
          arrivalHillMidRef={arrivalHillMidRef}
          arrivalHillFrontRef={arrivalHillFrontRef}
          arrivalPathRef={arrivalPathRef}
          arrivalCoopRef={arrivalCoopRef}
          arrivalCoopGlowRef={arrivalCoopGlowRef}
          arrivalInsideFlockRef={arrivalInsideFlockRef}
          arrivalChickenRefs={arrivalChickenRefs}
        />
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

export function App({ devEnvironment = null, devEnvironmentState = null }: LandingAppProps) {
  return (
    <I18nProvider>
      <LandingPageContent devEnvironmentState={devEnvironmentState ?? devEnvironment} />
    </I18nProvider>
  );
}
