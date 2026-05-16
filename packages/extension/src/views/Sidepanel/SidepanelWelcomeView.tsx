const POPUP_NAV_KEY = 'coop:popup-navigation';

async function openPopupToScreen(screen: 'create' | 'join') {
  try {
    const result = await chrome.storage.local.get(POPUP_NAV_KEY);
    const current = (result[POPUP_NAV_KEY] as Record<string, unknown>) ?? {};
    await chrome.storage.local.set({ [POPUP_NAV_KEY]: { ...current, screen } });
  } catch {
    // Fall through — popup will open to its default screen.
  }
  chrome.action?.openPopup?.();
  // Close the sidepanel so the user can focus on the popup create/join flow.
  window.close();
}

export function SidepanelWelcomeView() {
  return (
    <section className="sidepanel-welcome" aria-labelledby="sidepanel-welcome-heading">
      <img
        className="sidepanel-welcome__mark"
        src="/icons/icon-128.png"
        alt=""
        aria-hidden="true"
      />
      <div className="sidepanel-welcome__copy">
        <span className="sidepanel-welcome__eyebrow">Welcome</span>
        <h1 id="sidepanel-welcome-heading">Ready to round up your loose chickens?</h1>
      </div>
      <div className="sidepanel-welcome__actions">
        <button
          className="primary-button"
          onClick={() => void openPopupToScreen('create')}
          type="button"
        >
          Create a Coop
        </button>
        <button
          className="secondary-button"
          onClick={() => void openPopupToScreen('join')}
          type="button"
        >
          Join with Code
        </button>
      </div>
    </section>
  );
}
