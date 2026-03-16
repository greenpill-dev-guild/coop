import { useEffect, useRef } from 'react';

export const onboardingSteps = [
  {
    tab: 'Chickens' as const,
    title: 'Loose Chickens',
    body: 'Coop watches your open tabs and catches the useful ones here. All local, all private.',
  },
  {
    tab: 'Roost' as const,
    title: 'The Roost',
    body: 'Review, tidy, and shape your catches into drafts before sharing with the group.',
  },
  {
    tab: 'Feed' as const,
    title: 'Coop Feed',
    body: 'Publish what matters. Your flock sees it, and good finds turn into shared opportunities.',
  },
];

type OnboardingOverlayProps = {
  step: number | null;
  onAdvance: () => void;
  onDismiss: () => void;
};

export function OnboardingOverlay({ step, onAdvance, onDismiss }: OnboardingOverlayProps) {
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // Set inert on sibling elements to trap focus within the overlay
  useEffect(() => {
    if (step === null || step >= onboardingSteps.length) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const parent = dialog.parentElement;
    if (!parent) return;

    const siblings = Array.from(parent.children).filter((child) => child !== dialog);
    for (const sibling of siblings) {
      sibling.setAttribute('inert', '');
    }

    return () => {
      for (const sibling of siblings) {
        sibling.removeAttribute('inert');
      }
    };
  }, [step]);

  // Auto-focus the primary action button on mount
  useEffect(() => {
    if (step === null || step >= onboardingSteps.length) return;
    primaryRef.current?.focus();
  }, [step]);

  if (step === null || step >= onboardingSteps.length) {
    return null;
  }

  const isFinalStep = step >= onboardingSteps.length - 1;

  return (
    <dialog
      className="onboarding-overlay"
      open
      aria-label="Welcome to Coop"
      ref={dialogRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onDismiss();
        }
      }}
    >
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {onboardingSteps.map((s, i) => (
            <div
              key={s.tab}
              className={`onboarding-dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
            />
          ))}
        </div>
        <h2>{onboardingSteps[step].title}</h2>
        <p>{onboardingSteps[step].body}</p>
        <div className="action-row">
          <button className="primary-button" onClick={onAdvance} type="button" ref={primaryRef}>
            {isFinalStep ? 'Get started' : 'Next'}
          </button>
          {!isFinalStep ? (
            <button className="secondary-button" onClick={onDismiss} type="button">
              Skip
            </button>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
