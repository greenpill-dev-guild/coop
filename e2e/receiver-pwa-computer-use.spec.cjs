const { expect, test } = require('@playwright/test');

const hatchViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

function qa(page, name) {
  return page.locator(`[data-qa="${name}"]`);
}

async function expectHatchLayoutToFit(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto('/app/receiver?presentation=pwa&qa=reset,mock-media');

  await expect(qa(page, 'receiver-shell')).toHaveAttribute('data-route', 'receiver');
  await expect(qa(page, 'hatch-screen')).toBeVisible();
  await expect(qa(page, 'record-button')).toBeVisible();
  await expect(qa(page, 'take-photo')).toBeVisible();
  await expect(qa(page, 'attach-file')).toBeVisible();
  await expect(qa(page, 'last-saved-strip')).toBeVisible();
  await expect(qa(page, 'receiver-nav')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      };
    };
    const overlaps = (a, b) =>
      Boolean(
        a &&
          b &&
          !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom),
      );
    const visible = (rect) =>
      Boolean(
        rect &&
          rect.width >= 1 &&
          rect.height >= 1 &&
          rect.top >= -1 &&
          rect.left >= -1 &&
          rect.bottom <= window.innerHeight + 1 &&
          rect.right <= window.innerWidth + 1,
      );
    const doc = document.scrollingElement || document.documentElement;
    const main = document.querySelector('[data-qa="receiver-main"]');
    const record = rectFor('[data-qa="record-button"]');
    const photo = rectFor('[data-qa="take-photo"]');
    const attach = rectFor('[data-qa="attach-file"]');
    const strip = rectFor('[data-qa="last-saved-strip"]');
    const nav = rectFor('[data-qa="receiver-nav"]');

    return {
      attachVisible: visible(attach),
      docScrollDelta: doc.scrollHeight - doc.clientHeight,
      mainOverflowY: main ? getComputedStyle(main).overflowY : null,
      mainScrollDelta: main ? main.scrollHeight - main.clientHeight : null,
      mediaBelowRecord: Boolean(
        photo && attach && record && photo.top > record.top && attach.top > record.top,
      ),
      navOverlapsControls: [record, photo, attach, strip].some((rect) => overlaps(rect, nav)),
      navVisible: visible(nav),
      photoVisible: visible(photo),
      recordMinTapTarget: Boolean(record && record.width >= 44 && record.height >= 44),
      recordVisible: visible(record),
      stripVisible: visible(strip),
    };
  });

  expect(metrics).toMatchObject({
    attachVisible: true,
    mainOverflowY: 'hidden',
    mediaBelowRecord: true,
    navOverlapsControls: false,
    navVisible: true,
    photoVisible: true,
    recordMinTapTarget: true,
    recordVisible: true,
    stripVisible: true,
  });
  expect(metrics.docScrollDelta).toBeLessThanOrEqual(1);
  expect(metrics.mainScrollDelta).toBeLessThanOrEqual(1);
}

async function expectReceiverRouteReadableAt(page, route, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${route}?presentation=pwa&qa=reset,seed-empty`);

  await expect(qa(page, 'receiver-shell')).toBeVisible();
  await expect(qa(page, 'receiver-nav')).toBeVisible();
  await expect(qa(page, route.includes('/pair') ? 'mate-screen' : 'roost-screen')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('[data-qa="receiver-main"]');
    const card = document.querySelector('.receiver-card');
    const mainRect = main?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    return {
      cardWidth: cardRect?.width ?? 0,
      horizontalOverflow:
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
        window.innerWidth,
      mainWidth: mainRect?.width ?? 0,
    };
  });

  expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(metrics.mainWidth).toBeGreaterThanOrEqual(600);
  expect(metrics.cardWidth).toBeGreaterThanOrEqual(560);
}

test.describe('receiver PWA Browser-first evals', () => {
  test('normal browser hits to app routes stay website-first', async ({ page }) => {
    await page.goto('/app/receiver');

    await expect(page).toHaveURL(/\/$/);
    await expect(qa(page, 'public-install-action')).toBeVisible();
    await expect(qa(page, 'receiver-shell')).toHaveCount(0);
  });

  test('public install action opens browser-owned install education', async ({ page }) => {
    await page.goto('/');

    await qa(page, 'public-install-action').click();

    await expect(qa(page, 'public-install-dialog')).toBeVisible();
    await expect(page.getByText(/install coop on this phone/i)).toBeVisible();
    await expect(page.getByText(/install app|add to home screen/i).first()).toBeVisible();
    await expect(page.locator('.public-install-url')).toHaveAttribute('href', /\/app/);
  });

  for (const viewport of hatchViewports) {
    test(`Hatch fits without scroll at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await expectHatchLayoutToFit(page, viewport);
    });
  }

  test('mock-media mode exercises first-class audio capture without OS prompts', async ({
    page,
  }) => {
    await page.goto('/app/receiver?presentation=pwa&qa=seed-empty,mock-media');

    await qa(page, 'record-button').click();
    await expect(qa(page, 'save-voice-note')).toBeVisible();
    await expect(qa(page, 'cancel-voice-note')).toBeVisible();

    await qa(page, 'save-voice-note').click();

    await expect(qa(page, 'receiver-live-message')).toContainText(/saved on this phone/i);
    await expect(qa(page, 'last-saved-strip')).toContainText(/Voice note/i);
  });

  test('Mate default keeps QR primary and paste disclosure collapsed', async ({ page }) => {
    await page.goto('/app/pair?presentation=pwa&qa=seed-empty');

    await expect(qa(page, 'mate-screen')).toBeVisible();
    await expect(qa(page, 'scan-qr')).toBeVisible();
    await expect(qa(page, 'paste-code')).toBeVisible();
    await expect(qa(page, 'continue-without-pairing')).toBeVisible();
    await expect(qa(page, 'pairing-payload')).toHaveCount(0);

    await qa(page, 'paste-code').click();

    await expect(qa(page, 'pairing-payload')).toBeVisible();
  });

  test('Roost seeded state exposes failed-only retry and item action sheet', async ({ page }) => {
    await page.goto('/app/inbox?presentation=pwa&qa=seed-failed-sync');

    await expect(qa(page, 'roost-screen')).toBeVisible();
    await expect(qa(page, 'roost-item')).toHaveCount(4);
    await expect(qa(page, 'retry-sync')).toHaveCount(1);
    await expect(qa(page, 'remove-item')).toHaveCount(4);

    await qa(page, 'roost-item')
      .filter({ hasText: 'QA shared link' })
      .locator('[data-qa="more-actions"]')
      .click();

    await expect(qa(page, 'copy-link')).toBeVisible();
  });

  test('Mate and Roost stay readable in the desktop/narrow PWA shell', async ({ browser }) => {
    const viewport = { width: 1024, height: 768 };
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    try {
      await expectReceiverRouteReadableAt(page, '/app/pair', viewport);
      await expectReceiverRouteReadableAt(page, '/app/inbox', viewport);
    } finally {
      await context.close();
    }
  });
});
