const { expect, test } = require('@playwright/test');

function encodeSnapshot(value) {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildBoardSnapshotFixture() {
  const coopId = 'coop-board-e2e';
  const memberId = 'member-board-e2e';
  const artifactId = 'artifact-board-e2e';
  const receiptId = 'receipt-board-e2e';

  return {
    version: 1,
    coopId,
    createdAt: '2026-03-12T18:05:00.000Z',
    activeMemberId: memberId,
    activeMemberDisplayName: 'Mina',
    receiverCaptures: [
      {
        id: 'capture-board-e2e',
        deviceId: 'device-board-e2e',
        pairingId: 'pairing-board-e2e',
        coopId,
        coopDisplayName: 'Board Coop',
        memberId,
        memberDisplayName: 'Mina',
        kind: 'file',
        title: 'forest-notes.txt',
        note: 'Archive this after review.',
        fileName: 'forest-notes.txt',
        mimeType: 'text/plain',
        byteSize: 88,
        createdAt: '2026-03-12T18:00:00.000Z',
        updatedAt: '2026-03-12T18:00:00.000Z',
        syncState: 'synced',
        syncedAt: '2026-03-12T18:01:00.000Z',
        retryCount: 0,
        intakeStatus: 'draft',
        linkedDraftId: 'draft-receiver-capture-board-e2e',
        archiveWorthiness: {
          flagged: true,
          flaggedAt: '2026-03-12T18:01:30.000Z',
        },
      },
    ],
    drafts: [
      {
        id: 'draft-receiver-capture-board-e2e',
        interpretationId: 'receiver-interpretation-capture-board-e2e',
        extractId: 'receiver-extract-capture-board-e2e',
        sourceCandidateId: 'receiver-source-capture-board-e2e',
        title: 'forest-notes.txt',
        summary:
          'Summary placeholder: note what this file contains and why it should enter review.',
        sources: [
          {
            label: 'forest-notes.txt',
            url: 'coop://receiver/capture-board-e2e',
            domain: 'receiver.local',
          },
        ],
        tags: ['receiver', 'file', 'board-coop'],
        category: 'resource',
        whyItMatters:
          'Mina captured this privately for Board Coop. Clarify why it matters before pushing it into shared memory.',
        suggestedNextStep:
          'Review the file metadata, add context, and decide whether Board Coop should publish it.',
        suggestedTargetCoopIds: [coopId],
        confidence: 0.4,
        rationale:
          'Receiver draft seeded from local metadata only. No transcription or model inference was used.',
        status: 'draft',
        workflowStage: 'ready',
        provenance: {
          type: 'receiver',
          captureId: 'capture-board-e2e',
          pairingId: 'pairing-board-e2e',
          coopId,
          memberId,
          receiverKind: 'file',
          seedMethod: 'metadata-only',
        },
        createdAt: '2026-03-12T18:02:00.000Z',
        archiveWorthiness: {
          flagged: true,
          flaggedAt: '2026-03-12T18:01:30.000Z',
        },
      },
    ],
    coopState: {
      profile: {
        id: coopId,
        name: 'Board Coop',
        purpose: 'Make capture, review, publish, and archive flows legible.',
        createdAt: '2026-03-12T17:55:00.000Z',
        createdBy: memberId,
        captureMode: 'manual',
        safeAddress: '0x1111111111111111111111111111111111111111',
        active: true,
      },
      setupInsights: {
        summary: 'A compact setup payload for board rendering and archive receipt storytelling.',
        crossCuttingPainPoints: ['Context slips between review and archive'],
        crossCuttingOpportunities: ['Make archive receipts visible in the board'],
        lenses: [
          {
            lens: 'capital-formation',
            currentState: 'Funding links live in browsers.',
            painPoints: 'The best leads disappear.',
            improvements: 'Archive the good ones visibly.',
          },
          {
            lens: 'impact-reporting',
            currentState: 'Evidence lands late.',
            painPoints: 'Snapshots are hard to inspect.',
            improvements: 'Keep the archive trail legible.',
          },
          {
            lens: 'governance-coordination',
            currentState: 'Reviews happen weekly.',
            painPoints: 'Good context leaves no trail.',
            improvements: 'Show the board and archive story together.',
          },
          {
            lens: 'knowledge-garden-resources',
            currentState: 'Research stays private too long.',
            painPoints: 'Artifacts lose provenance.',
            improvements: 'Preserve capture to archive relationships.',
          },
        ],
      },
      soul: {
        purposeStatement: 'Make capture, review, publish, and archive flows legible.',
        toneAndWorkingStyle: 'Pragmatic and warm.',
        usefulSignalDefinition: 'Signals that deserve shared memory and durable archives.',
        artifactFocus: ['insights', 'evidence'],
        whyThisCoopExists: 'To keep the best signals inspectable.',
      },
      rituals: [
        {
          weeklyReviewCadence: 'Weekly review circle',
          namedMoments: ['Board review'],
          facilitatorExpectation: 'One member keeps the archive story legible.',
          defaultCapturePosture: 'Review before publish.',
        },
      ],
      members: [
        {
          id: memberId,
          displayName: 'Mina',
          role: 'creator',
          authMode: 'wallet',
          address: '0x1111111111111111111111111111111111111111',
          joinedAt: '2026-03-12T17:55:00.000Z',
          identityWarning: 'Device bound.',
        },
      ],
      invites: [],
      artifacts: [
        {
          id: artifactId,
          originId: 'origin-board-e2e',
          targetCoopId: coopId,
          title: 'Setup Insights',
          summary: 'A durable artifact for the board flow.',
          sources: [
            {
              label: 'Setup insights',
              url: 'coop://board-coop/setup-insights',
              domain: 'coop.local',
            },
          ],
          tags: ['setup-insight', 'board'],
          category: 'setup-insight',
          whyItMatters: 'It anchors the archive story.',
          suggestedNextStep: 'Archive it visibly.',
          createdBy: memberId,
          createdAt: '2026-03-12T17:56:00.000Z',
          reviewStatus: 'published',
          archiveStatus: 'archived',
          archiveReceiptIds: [receiptId],
          archiveWorthiness: {
            flagged: true,
            flaggedAt: '2026-03-12T18:03:00.000Z',
          },
        },
      ],
      reviewBoard: [
        {
          id: 'group-board-e2e',
          groupBy: 'category',
          label: 'setup-insight',
          artifactIds: [artifactId],
        },
      ],
      archiveReceipts: [
        {
          id: receiptId,
          scope: 'artifact',
          targetCoopId: coopId,
          artifactIds: [artifactId],
          bundleReference: 'bundle-board-e2e',
          rootCid: 'bafyboardreceipte2e1234567890',
          shardCids: ['bafyboardreceipte2eshard1234567890'],
          pieceCids: [],
          gatewayUrl: 'https://storacha.link/ipfs/bafyboardreceipte2e1234567890',
          uploadedAt: '2026-03-12T18:04:00.000Z',
          filecoinStatus: 'offered',
          delegationIssuer: 'trusted-node-demo',
        },
      ],
      memoryProfile: {
        version: 1,
        updatedAt: '2026-03-12T18:04:00.000Z',
        topDomains: [],
        topTags: [],
        categoryStats: [],
        ritualLensWeights: [],
        exemplarArtifactIds: [artifactId],
        archiveSignals: {
          archivedTagCounts: {
            board: 1,
          },
          archivedDomainCounts: {
            'coop.local': 1,
          },
        },
      },
      syncRoom: {
        coopId,
        roomSecret: 'room-secret-board-e2e',
        roomId: 'room-board-e2e',
        inviteSigningSecret: 'invite-secret-board-e2e',
        signalingUrls: ['ws://127.0.0.1:4444'],
      },
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: '0x1111111111111111111111111111111111111111',
        senderAddress: '0x1111111111111111111111111111111111111111',
        safeCapability: 'stubbed',
        statusNote: 'Mock safe ready for board testing.',
      },
    },
  };
}

test('landing page renders the refreshed narrative', async ({ page }) => {
  await page.goto('/landing');

  await expect(page.getByRole('heading', { name: /no more chickens loose/i })).toBeVisible();
  await expect(page.locator('.hero-title-line')).toHaveCount(2);
  await expect(page.getByText(/turning knowledge into opportunity/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^how coop works$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^curate your coop$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^why we build$/i })).toBeVisible();
  await expect(page.getByText(/your data stays yours/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /reset ritual/i })).toBeVisible();
  await expect(page.locator('.hero-signal-cluster')).toBeVisible();
  await expect(page.locator('.how-works-index')).toHaveCount(4);

  const firstSignalOpacity = await page
    .locator('.journey-scene-story .scene-chicken-label')
    .first()
    .evaluate((node) => {
      return Number.parseFloat(window.getComputedStyle(node).opacity);
    });
  expect(firstSignalOpacity).toBeGreaterThan(0.2);

  const logoBox = await page.locator('.hero-logo').boundingBox();
  if (!logoBox) {
    throw new Error('Hero logo did not render for bounding box check.');
  }
  expect(logoBox.x).toBeLessThan(140);

  await page.locator('#why-build').scrollIntoViewIfNeeded();
  await expect(page.getByText('Afolabi Aiyeloja')).toBeVisible();
  await expect(page.getByText('Greenpill Dev Guild')).toBeVisible();

  await page.getByRole('button', { name: /collective intelligence/i }).click();
  await expect(page.getByRole('dialog', { name: /collective intelligence/i })).toBeVisible();
  const stageBox = await page.locator('.flashcard-stage').boundingBox();
  const viewport = page.viewportSize();
  if (!stageBox || !viewport) {
    throw new Error('Flashcard stage or viewport missing for alignment check.');
  }
  expect(Math.abs(stageBox.x + stageBox.width / 2 - viewport.width / 2)).toBeLessThan(170);
  await expect(page.getByRole('button', { name: /^close card$/i })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /collective intelligence notes/i })).toBeVisible();
  await page.locator('.flashcard-focus-shell').click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole('textbox', { name: /collective intelligence notes/i })).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: /funding & resources/i }).click();
  await expect(page.getByRole('textbox', { name: /funding & resources notes/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: /funding & resources notes/i })).toHaveCount(0);
});

test('landing page stays legible on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'This scenario validates the mobile project only.');

  await page.goto('/landing');

  await expect(page.getByRole('heading', { name: /no more chickens loose/i })).toBeVisible();
  await expect(page.getByText(/turning knowledge into opportunity/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /collective intelligence/i })).toBeVisible();
});

test('receiver route exposes the egg capture shell and Roost link', async ({ page }) => {
  await page.goto('/receiver');

  await expect(page.getByRole('heading', { name: /^Hatch$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start recording/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /take photo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /attach file/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roost', exact: true })).toBeVisible();
});

test('@flow-board board route renders a coop snapshot with archive storytelling', async ({
  page,
}) => {
  const snapshot = buildBoardSnapshotFixture();
  const encoded = encodeSnapshot(snapshot);

  await page.goto(`/board/${snapshot.coopId}#snapshot=${encoded}`);

  await expect(page.getByRole('heading', { name: 'Board Coop' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/board/${snapshot.coopId}$`));
  await expect(page.getByRole('heading', { name: /saved proof trail/i })).toBeVisible();
  const boardSurface = page.getByTestId('coop-board-surface');
  await expect(boardSurface.getByText('forest-notes.txt').first()).toBeVisible();
  await expect(boardSurface.getByText('captured by').first()).toBeVisible();
  await expect(boardSurface.getByText('draft seeded from capture').first()).toBeVisible();
  await expect(boardSurface.getByText('published to coop').first()).toBeVisible();
  await expect(page.getByText(/what the coop kept/i)).toBeVisible();
  await expect(page.getByText('Save ID')).toBeVisible();
  await expect(page.getByRole('link', { name: /open saved bundle/i }).first()).toBeVisible();
});
