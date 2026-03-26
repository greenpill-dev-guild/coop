const STANDARD_HOST_ORIGINS = ['http://*/*', 'https://*/*'] as const;

function isStandardWebUrl(url?: string): url is string {
  return Boolean(url?.startsWith('http://') || url?.startsWith('https://'));
}

function toOriginPattern(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

async function queryActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ?? null;
  } catch {
    return null;
  }
}

async function ensureStandardHostAccess(urls: string[] = []) {
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    return { ok: true } as const;
  }

  const originPatterns = Array.from(
    new Set(urls.map((url) => toOriginPattern(url)).filter((value) => value !== null)),
  );

  if (originPatterns.length === 0) {
    return { ok: true } as const;
  }

  const missingOrigins: string[] = [];
  for (const origin of originPatterns) {
    const hasAccess = await chrome.permissions.contains({
      origins: [origin],
    });
    if (!hasAccess) {
      missingOrigins.push(origin);
    }
  }

  if (missingOrigins.length === 0) {
    return { ok: true } as const;
  }

  try {
    const granted = await chrome.permissions.request({
      origins: missingOrigins,
    });
    return granted
      ? ({ ok: true } as const)
      : ({
          ok: false,
          error: 'Coop needs webpage access to round up and capture standard sites.',
        } as const);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not request webpage access.',
    } as const;
  }
}

export async function preflightManualCapture() {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not inspect open tabs.',
    } as const;
  }

  const supportedTabs = tabs.filter((tab) => isStandardWebUrl(tab.url));
  if (supportedTabs.length === 0) {
    return {
      ok: false,
      error: 'Open at least one standard web page before rounding up tabs.',
    } as const;
  }

  return ensureStandardHostAccess(supportedTabs.flatMap((tab) => (tab.url ? [tab.url] : [])));
}

export async function preflightActiveTabCapture() {
  const tab = await queryActiveTab();
  if (!tab || !isStandardWebUrl(tab.url)) {
    return {
      ok: false,
      error: 'Open a standard web page before capturing this tab.',
    } as const;
  }

  // Active-tab capture is user initiated from the popup/command surface and can
  // rely on the temporary activeTab grant. Reserve the broader host-permission
  // prompt for roundup flows that inspect arbitrary tabs.
  return { ok: true, tab } as const;
}

export async function preflightScreenshotCapture() {
  const tab = await queryActiveTab();
  if (!tab || !isStandardWebUrl(tab.url)) {
    return {
      ok: false,
      error: 'Open a standard web page before taking a screenshot.',
    } as const;
  }

  if (tab.windowId == null) {
    return {
      ok: false,
      error: 'Could not identify the current browser window.',
    } as const;
  }

  return { ok: true, tab } as const;
}

export { isStandardWebUrl, STANDARD_HOST_ORIGINS, toOriginPattern };
