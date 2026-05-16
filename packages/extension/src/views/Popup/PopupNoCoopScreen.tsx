import { PopupOnboardingHero } from './PopupOnboardingHero';

export function PopupNoCoopScreen(props: {
  onCreate: () => void;
  onJoin: () => void;
}) {
  const { onCreate, onJoin } = props;

  return (
    <section className="popup-screen popup-screen--onboarding popup-screen--welcome">
      <PopupOnboardingHero variant="welcome" />
      <div className="popup-copy-block popup-copy-block--welcome">
        <span className="popup-eyebrow">Welcome</span>
        <h1>Ready to round up your loose chickens?</h1>
      </div>
      <div className="popup-stack">
        <button className="popup-primary-action" onClick={onCreate} type="button">
          Create a Coop
        </button>
        <button className="popup-secondary-action" onClick={onJoin} type="button">
          Join with Code
        </button>
      </div>
    </section>
  );
}
