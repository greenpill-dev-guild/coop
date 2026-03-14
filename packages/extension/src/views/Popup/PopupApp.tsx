import { useEffect, useState } from 'react';
import { type DashboardResponse, sendRuntimeMessage } from '../../runtime/messages';

export function PopupApp() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      const response = await sendRuntimeMessage<DashboardResponse>({ type: 'get-dashboard' });
      if (response.ok && response.data) {
        setDashboard(response.data);
      } else if (response.error) {
        setMessage(response.error);
      }
    })();
  }, []);

  async function openSidepanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } catch {
      await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      window.close();
    }
  }

  async function manualRoundUp() {
    const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
    setMessage(
      response.ok
        ? `Round-up complete. Coop checked ${response.data ?? 0} tabs.`
        : (response.error ?? 'Round-up failed.'),
    );
  }

  return (
    <div className="popup-shell">
      <img src="/branding/coop-wordmark-flat.png" alt="Coop" width={118} />
      <p className="helper-text">No more chickens loose.</p>
      <div className="panel-card">
        <h2>{dashboard?.summary.iconLabel ?? 'Loading'}</h2>
        <p className="helper-text">
          {dashboard?.summary.pendingDrafts ?? 0} drafts waiting ·{' '}
          {dashboard?.summary.syncState ?? '...'}
        </p>
        <div className="popup-actions">
          <button className="primary-button" onClick={openSidepanel} type="button">
            Open Coop
          </button>
          <button className="secondary-button" onClick={manualRoundUp} type="button">
            Round up now
          </button>
        </div>
      </div>
      {message ? <div className="panel-card helper-text">{message}</div> : null}
    </div>
  );
}
