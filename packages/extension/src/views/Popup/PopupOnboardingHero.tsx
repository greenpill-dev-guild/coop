export function PopupOnboardingHero(props: {
  variant: 'welcome' | 'create' | 'join' | 'empty' | 'empty-meadow' | 'empty-coop-feed';
}) {
  const { variant } = props;

  if (variant === 'empty-coop-feed') {
    return (
      <div
        className="popup-onboarding-hero popup-onboarding-hero--empty-coop-feed"
        aria-hidden="true"
      >
        <svg
          className="popup-onboarding-hero__coop-feed-svg"
          viewBox="0 0 160 100"
          fill="none"
          aria-hidden="true"
        >
          {/* Ground */}
          <ellipse cx="80" cy="92" rx="70" ry="8" fill="currentColor" opacity="0.06" />

          {/* Fence posts */}
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2">
            <path d="M30 60v30" />
            <path d="M55 60v30" />
            <path d="M105 60v30" />
            <path d="M130 60v30" />
          </g>

          {/* Fence rails */}
          <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.15">
            <path d="M30 68h100" />
            <path d="M30 78h100" />
          </g>

          {/* Nest / bowl */}
          <ellipse
            cx="80"
            cy="82"
            rx="18"
            ry="7"
            stroke="var(--coop-green, #5a7d10)"
            strokeWidth="1.6"
            opacity="0.35"
          />
          <path
            d="M62 82c0-8 8-14 18-14s18 6 18 14"
            stroke="var(--coop-green, #5a7d10)"
            strokeWidth="1.6"
            opacity="0.25"
            fill="none"
          />

          {/* Grass tufts */}
          <g
            stroke="var(--coop-green, #5a7d10)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.35"
          >
            <path d="M20 92c0-6 2-10 2-10" />
            <path d="M23 92c-1-5 1-9 1-9" />
            <path d="M140 92c0-6 2-10 2-10" />
            <path d="M137 92c1-5 -1-9 -1-9" />
          </g>

          {/* Sun / warmth circle */}
          <circle cx="130" cy="22" r="10" fill="currentColor" opacity="0.04" />
          <circle cx="130" cy="22" r="6" stroke="currentColor" strokeWidth="1.2" opacity="0.12" />

          {/* Rays */}
          <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1">
            <path d="M130 10v4" />
            <path d="M130 30v4" />
            <path d="M118 22h4" />
            <path d="M138 22h4" />
          </g>
        </svg>
      </div>
    );
  }

  if (variant === 'empty-meadow') {
    return (
      <div className="popup-onboarding-hero popup-onboarding-hero--empty-meadow" aria-hidden="true">
        <svg
          className="popup-onboarding-hero__meadow-svg"
          viewBox="0 0 160 100"
          fill="none"
          aria-hidden="true"
        >
          {/* Ground */}
          <ellipse cx="80" cy="92" rx="70" ry="8" fill="currentColor" opacity="0.06" />

          {/* Grass tufts */}
          <g
            stroke="var(--coop-green, #5a7d10)"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.4"
          >
            <path d="M24 92c0-8 3-14 3-14" />
            <path d="M27 92c-1-7 2-12 2-12" />
            <path d="M30 92c-2-6 0-10 0-10" />
            <path d="M130 92c0-8 3-14 3-14" />
            <path d="M133 92c-1-7 2-12 2-12" />
            <path d="M136 92c-2-6 0-10 0-10" />
          </g>

          {/* Chicken body */}
          <ellipse
            cx="80"
            cy="62"
            rx="18"
            ry="14"
            stroke="currentColor"
            strokeWidth="1.8"
            opacity="0.35"
          />

          {/* Chicken head */}
          <circle cx="66" cy="48" r="8" stroke="currentColor" strokeWidth="1.8" opacity="0.35" />

          {/* Eye */}
          <circle cx="63.5" cy="47" r="1.5" fill="currentColor" opacity="0.35" />

          {/* Beak */}
          <path
            d="M58 49l-3.5-1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M58 50.5l-3 0.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.35"
          />

          {/* Comb */}
          <path
            d="M64 40.5c1-2.5 3-3 3.5-2.5s-0.5 2 1 1c1.5-1 2.5-0.5 2 1"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.3"
          />

          {/* Tail feathers */}
          <path
            d="M97 54c3-2 5-6 5.5-9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M96 57c4-1 7-4 8-8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Legs */}
          <path
            d="M74 76l-3 12M86 76l3 12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M68 88l6 0M86 88l6 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Question mark / looking around */}
          <g opacity="0.2" fill="currentColor">
            <path
              d="M48 32c0-3 2-5 5-5s5 1.5 5 4-2 3-3 4.5c-.5.8-.5 1.5-.5 1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="54.5" cy="39" r="1" />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className={`popup-onboarding-hero popup-onboarding-hero--${variant}`} aria-hidden="true">
      <div className="popup-onboarding-hero__scene">
        <img alt="" className="popup-onboarding-hero__mark" src="/icons/icon-128.png" />
        <div className="popup-onboarding-hero__nest" />

        {variant === 'welcome' ? (
          <>
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--one" />
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--two" />
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--three" />
          </>
        ) : null}

        {variant === 'create' ? (
          <>
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--center" />
            <span className="popup-onboarding-hero__badge popup-onboarding-hero__badge--create">
              +
            </span>
            <span className="popup-onboarding-hero__sprout popup-onboarding-hero__sprout--left" />
            <span className="popup-onboarding-hero__sprout popup-onboarding-hero__sprout--right" />
          </>
        ) : null}

        {variant === 'join' ? (
          <>
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--join-left" />
            <span className="popup-onboarding-hero__egg popup-onboarding-hero__egg--join-right" />
            <div className="popup-onboarding-hero__ticket">
              <span />
              <span />
              <span />
            </div>
            <div className="popup-onboarding-hero__trail" />
          </>
        ) : null}
      </div>
    </div>
  );
}
