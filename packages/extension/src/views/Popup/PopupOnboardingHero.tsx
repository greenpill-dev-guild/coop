export function PopupOnboardingHero(props: {
  variant: 'welcome' | 'create' | 'join' | 'empty';
}) {
  const { variant } = props;

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
