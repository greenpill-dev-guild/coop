import { describe, expect, it, vi } from 'vitest';
import { installChromeMock, makeDashboardResponse } from './index';

describe('extension test fixture factories', () => {
  describe('installChromeMock', () => {
    it('installs a chrome global with storage, tabs, sidePanel, and runtime', () => {
      installChromeMock();
      expect(globalThis.chrome).toBeDefined();
      expect(chrome.storage.local.get).toBeDefined();
      expect(chrome.tabs.query).toBeDefined();
      expect(chrome.sidePanel.open).toBeDefined();
      expect(chrome.runtime.getURL).toBeDefined();
    });

    it('returns usable mock functions', async () => {
      installChromeMock();
      const result = await chrome.storage.local.get('key');
      expect(result).toEqual({});
      const url = chrome.runtime.getURL('popup.html');
      expect(url).toBe('chrome-extension://popup.html');
    });
  });

  describe('makeDashboardResponse', () => {
    it('returns a valid dashboard with sensible defaults', () => {
      const dashboard = makeDashboardResponse();
      expect(dashboard.coops).toHaveLength(1);
      expect(dashboard.coops[0].profile.id).toBe('coop-1');
      expect(dashboard.activeCoopId).toBe('coop-1');
      expect(dashboard.summary.syncTone).toBe('ok');
    });

    it('applies overrides', () => {
      const dashboard = makeDashboardResponse({
        activeCoopId: 'coop-2',
        drafts: [{ id: 'draft-1' }],
      });
      expect(dashboard.activeCoopId).toBe('coop-2');
      expect(dashboard.drafts).toHaveLength(1);
    });

    it('produces a deep override for nested summary', () => {
      const dashboard = makeDashboardResponse({
        summary: {
          ...makeDashboardResponse().summary,
          syncTone: 'warning',
          syncLabel: 'Local',
        },
      });
      expect(dashboard.summary.syncTone).toBe('warning');
      expect(dashboard.summary.syncLabel).toBe('Local');
    });
  });
});
