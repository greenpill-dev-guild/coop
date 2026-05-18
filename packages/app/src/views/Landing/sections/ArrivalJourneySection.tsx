import type { MutableRefObject, RefObject } from 'react';
import { useI18n } from '../../../hooks/useI18n';
import { ChickenSprite, CoopIllustration } from '../landing-animations';
import { STAR_COUNT, arrivalChickenCommunities, journeyChickens, starStyle } from '../landing-data';

export type ArrivalJourneySectionProps = {
  arrivalJourneyRef: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  arrivalNightSkyRef: RefObject<HTMLDivElement | null>;
  arrivalStarsRef: RefObject<HTMLDivElement | null>;
  arrivalMoonRef: RefObject<HTMLDivElement | null>;
  arrivalGlowLeftRef: RefObject<HTMLDivElement | null>;
  arrivalGlowRightRef: RefObject<HTMLDivElement | null>;
  arrivalCloudRef: RefObject<HTMLDivElement | null>;
  arrivalHillBackRef: RefObject<HTMLDivElement | null>;
  arrivalHillMidRef: RefObject<HTMLDivElement | null>;
  arrivalHillFrontRef: RefObject<HTMLDivElement | null>;
  arrivalPathRef: RefObject<HTMLDivElement | null>;
  arrivalCoopRef: RefObject<HTMLDivElement | null>;
  arrivalCoopGlowRef: RefObject<HTMLDivElement | null>;
  arrivalInsideFlockRef: RefObject<HTMLDivElement | null>;
  arrivalChickenRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
};

export function ArrivalJourneySection({
  arrivalJourneyRef,
  prefersReducedMotion,
  arrivalNightSkyRef,
  arrivalStarsRef,
  arrivalMoonRef,
  arrivalGlowLeftRef,
  arrivalGlowRightRef,
  arrivalCloudRef,
  arrivalHillBackRef,
  arrivalHillMidRef,
  arrivalHillFrontRef,
  arrivalPathRef,
  arrivalCoopRef,
  arrivalCoopGlowRef,
  arrivalInsideFlockRef,
  arrivalChickenRefs,
}: ArrivalJourneySectionProps) {
  const { t } = useI18n();

  function setArrivalChickenRef(id: string) {
    return (node: HTMLDivElement | null) => {
      arrivalChickenRefs.current[id] = node;
    };
  }

  return (
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
                  label={communityLabel ?? (chicken.labelKey ? t(chicken.labelKey) : chicken.label)}
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
        </div>
      </div>

      <div className="journey-panels">
        <article className="journey-panel why-build-panel" />
        <div className="arrival-scroll-spacer" aria-hidden="true" />
      </div>
    </section>
  );
}
