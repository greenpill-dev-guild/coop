import type { MutableRefObject, RefObject } from 'react';
import { DevTunnelBadge } from '../../../components/DevTunnelBadge';
import type { DevEnvironmentState } from '../../../dev-environment';
import { useI18n } from '../../../hooks/useI18n';
import { ChickenSprite } from '../landing-animations';
import { howItWorksCards, journeyChickens } from '../landing-data';
import type { TranscriptKey } from '../landing-types';

export type StoryJourneySectionProps = {
  storyJourneyRef: RefObject<HTMLElement | null>;
  prefersReducedMotion: boolean;
  storySkyOverlayRef: RefObject<HTMLDivElement | null>;
  storyGlowLeftRef: RefObject<HTMLDivElement | null>;
  storyGlowRightRef: RefObject<HTMLDivElement | null>;
  storySunRef: RefObject<HTMLDivElement | null>;
  storySunWarmRef: RefObject<HTMLDivElement | null>;
  storyCloudARef: RefObject<HTMLDivElement | null>;
  storyCloudBRef: RefObject<HTMLDivElement | null>;
  storyHillBackRef: RefObject<HTMLDivElement | null>;
  storyHillMidRef: RefObject<HTMLDivElement | null>;
  storyHillFrontRef: RefObject<HTMLDivElement | null>;
  storyPathRef: RefObject<HTMLDivElement | null>;
  storyChickenRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  heroCopyRef: RefObject<HTMLDivElement | null>;
  howItWorksRef: RefObject<HTMLDivElement | null>;
  heroScrollHintOpacity: number;
  devEnvironmentState: DevEnvironmentState | null;
};

export function StoryJourneySection({
  storyJourneyRef,
  prefersReducedMotion,
  storySkyOverlayRef,
  storyGlowLeftRef,
  storyGlowRightRef,
  storySunRef,
  storySunWarmRef,
  storyCloudARef,
  storyCloudBRef,
  storyHillBackRef,
  storyHillMidRef,
  storyHillFrontRef,
  storyPathRef,
  storyChickenRefs,
  heroCopyRef,
  howItWorksRef,
  heroScrollHintOpacity,
  devEnvironmentState,
}: StoryJourneySectionProps) {
  const { t } = useI18n();

  function setStoryChickenRef(id: string) {
    return (node: HTMLDivElement | null) => {
      storyChickenRefs.current[id] = node;
    };
  }

  return (
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
          {journeyChickens.map((chicken) => {
            const thoughtKey = chicken.thoughtKey ?? chicken.id;

            return (
              <div
                className={`scene-chicken scene-chicken-${chicken.id}`}
                data-facing={chicken.facing ?? 'right'}
                key={chicken.id}
                ref={setStoryChickenRef(chicken.id)}
              >
                <div className="thought-bubble" aria-hidden="true">
                  <span className="thought-kicker">
                    {t(`chickenThoughts.${thoughtKey}.kicker`)}
                  </span>
                  <span className="thought-text">{t(`chickenThoughts.${thoughtKey}.text`)}</span>
                </div>
                <ChickenSprite
                  color={chicken.color}
                  facing={chicken.facing}
                  label={chicken.labelKey ? t(chicken.labelKey) : chicken.label}
                  showLabel={true}
                  variant={chicken.variant}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="journey-panels">
        <article className="journey-panel hero-panel">
          <div className="hero-shell">
            <div className="hero-copy" ref={heroCopyRef}>
              <h1 className="hero-title">
                <span className="hero-title-line">{t('hero.title1')}</span>
                <span className="hero-title-line hero-title-line-bottom">{t('hero.title2')}</span>
              </h1>
              <p className="hero-subtitle">{t('hero.subtitle')}</p>
              <div className="hero-cta-row">
                <a className="button button-primary hero-cta-primary" href="#ritual">
                  {t('hero.curateCta')}
                </a>
                <a className="button button-secondary" href="#how-it-works">
                  {t('hero.howItWorksCta')}
                </a>
              </div>
              <p className="sr-only">
                Eight chickens start apart in the meadow and converge as you scroll.
              </p>
            </div>

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
            <DevTunnelBadge environment={devEnvironmentState} />
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
  );
}
