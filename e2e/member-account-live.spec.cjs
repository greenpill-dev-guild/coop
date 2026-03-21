const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium, expect, test } = require('@playwright/test');
const { ensureExtensionBuilt, extensionDir, rootDir } = require('./helpers/extension-build.cjs');

const closeTimeoutMs = 5000;
const runLive = process.env.COOP_RUN_MEMBER_ACCOUNT_LIVE === '1';
const greenGoodsRepoDir = process.env.COOP_GREEN_GOODS_REPO_DIR
  ? path.resolve(process.env.COOP_GREEN_GOODS_REPO_DIR)
  : path.resolve(rootDir, '..', '..', 'greenpill', 'green-goods');
const envFilePath = path.join(rootDir, '.env.local');
const envFile = fs.existsSync(envFilePath) ? parseDotEnv(fs.readFileSync(envFilePath, 'utf8')) : {};
const pimlicoApiKey = readEnvValue('VITE_PIMLICO_API_KEY');
const impactSchemaUid = readEnvValue('VITE_COOP_GREEN_GOODS_IMPACT_REPORT_SCHEMA_UID');
const sepoliaDeployment = resolveGreenGoodsSepoliaDeployment();
const workSchemaUid =
  readEnvValue('VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID') ?? sepoliaDeployment.schemas.workSchemaUID;
const hasImpactSchema = /^0x[a-fA-F0-9]{64}$/.test(impactSchemaUid ?? '');
const hasRequiredEnv = Boolean(pimlicoApiKey && /^0x[a-fA-F0-9]{64}$/.test(workSchemaUid ?? ''));

const viem = require(path.join(rootDir, 'packages/shared/node_modules/viem'));
const { createPublicClient, getContract, http, parseAbi } = viem;

const sepoliaPublicClient = createPublicClient({
  chain: {
    id: 11155111,
    name: 'Sepolia',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: ['https://ethereum-sepolia.publicnode.com'] } },
  },
  transport: http('https://ethereum-sepolia.publicnode.com'),
});

const actionRegistryAbi = parseAbi([
  'function getAction(uint256 actionUID) view returns ((uint256 startTime,uint256 endTime,string title,string slug,string instructions,uint8[] capitals,string[] media,uint8 domain))',
]);

const greenGoodsGardenTokenAuthAbi = parseAbi([
  'function owner() view returns (address)',
  'function deploymentRegistry() view returns (address)',
  'function openMinting() view returns (bool)',
]);

const greenGoodsDeploymentRegistryAbi = parseAbi([
  'function isInAllowlist(address account) view returns (bool)',
]);

function parseDotEnv(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .reduce((acc, line) => {
      const separator = line.indexOf('=');
      if (separator === -1) {
        return acc;
      }
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function readEnvValue(name) {
  const value = process.env[name] ?? envFile[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveGreenGoodsSepoliaDeployment() {
  const deploymentPath = path.join(
    greenGoodsRepoDir,
    'packages/contracts/deployments/11155111-latest.json',
  );
  if (fs.existsSync(deploymentPath)) {
    return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }

  return {
    actionRegistry: '0xB768203B1A3e3d6FaE0e788d0f9b99381ecB3Bae',
    schemas: {
      assessmentSchemaUID: '0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93',
      workApprovalSchemaUID: '0x6f44cac380791858e86c67c75de1f10b186fb6534c00f85b596709a3cd51f381',
      workSchemaUID: '0x43ebd37da5479df9d495a4c6514e7cb7f370e9f4166a0a58e14a3baf466078c4',
    },
  };
}

async function resolveActiveWorkAction(domainValue) {
  const registry = getContract({
    address: sepoliaDeployment.actionRegistry,
    abi: actionRegistryAbi,
    client: sepoliaPublicClient,
  });
  const now = BigInt(Math.floor(Date.now() / 1000));

  for (let actionUid = 0n; actionUid < 24n; actionUid += 1n) {
    const action = await registry.read.getAction([actionUid]);
    const isInitialized = action.startTime > 0n;
    const isActive = action.startTime <= now && action.endTime >= now;
    const matchesDomain = Number(action.domain) === domainValue;
    if (isInitialized && isActive && matchesDomain) {
      return {
        actionUid: Number(actionUid),
        title: action.title,
        slug: action.slug,
      };
    }
  }

  throw new Error(`No active Sepolia Green Goods action found for domain ${domainValue}.`);
}

async function inspectGardenMintAuthorization(safeAddress) {
  const owner = await sepoliaPublicClient.readContract({
    address: sepoliaDeployment.gardenToken,
    abi: greenGoodsGardenTokenAuthAbi,
    functionName: 'owner',
  });
  const deploymentRegistry = await sepoliaPublicClient.readContract({
    address: sepoliaDeployment.gardenToken,
    abi: greenGoodsGardenTokenAuthAbi,
    functionName: 'deploymentRegistry',
  });

  try {
    const openMinting = await sepoliaPublicClient.readContract({
      address: sepoliaDeployment.gardenToken,
      abi: greenGoodsGardenTokenAuthAbi,
      functionName: 'openMinting',
    });
    if (openMinting) {
      return {
        authorized: true,
        reason: 'open-minting',
        owner,
        deploymentRegistry,
      };
    }
  } catch {
    // Some deployments may not expose openMinting yet.
  }

  if (owner.toLowerCase() === safeAddress.toLowerCase()) {
    return {
      authorized: true,
      reason: 'owner',
      owner,
      deploymentRegistry,
    };
  }

  const allowlisted = await sepoliaPublicClient.readContract({
    address: deploymentRegistry,
    abi: greenGoodsDeploymentRegistryAbi,
    functionName: 'isInAllowlist',
    args: [safeAddress],
  });
  if (allowlisted) {
    return {
      authorized: true,
      reason: 'allowlist',
      owner,
      deploymentRegistry,
    };
  }

  return {
    authorized: false,
    owner,
    deploymentRegistry,
    detail: `Green Goods Sepolia currently restricts garden minting. Coop Safe ${safeAddress} is not the GardenToken owner ${owner} and is not allowlisted in deployment registry ${deploymentRegistry}. Ask Green Goods governance to allowlist this Safe or enable open minting before retrying the live flow.`,
  };
}

async function assertGardenMintAuthorized(safeAddress) {
  const inspection = await inspectGardenMintAuthorization(safeAddress);
  if (!inspection.authorized) {
    throw new Error(inspection.detail);
  }
}

function withTimeout(promise, timeoutMs, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function isBenignCloseError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (error.code === 'ENOENT') {
    return true;
  }

  return (
    error instanceof Error &&
    /Target page, context or browser has been closed|Browser has been closed/i.test(error.message)
  );
}

async function closeContextSafely(context) {
  if (!context) {
    return;
  }

  try {
    await Promise.allSettled(
      context.pages().map((page) =>
        withTimeout(page.close(), closeTimeoutMs, 'member live page.close').catch((error) => {
          if (!isBenignCloseError(error)) {
            throw error;
          }
        }),
      ),
    );

    await withTimeout(
      context.close({ reason: 'member live teardown' }),
      closeTimeoutMs,
      'member live context.close',
    );
  } catch (error) {
    if (isBenignCloseError(error)) {
      return;
    }

    const browser = context.browser();
    if (!browser) {
      throw error;
    }

    try {
      await withTimeout(
        browser.close({ reason: 'member live force teardown' }),
        closeTimeoutMs,
        'member live browser.close fallback',
      );
    } catch (browserError) {
      if (isBenignCloseError(browserError)) {
        return;
      }
      throw browserError;
    }
  }
}

async function openOptionalSetup(page) {
  const optionalSetup = page.locator('details.collapsible-card').first();
  const isOpen = await optionalSetup.evaluate((element) => element.hasAttribute('open'));
  if (!isOpen) {
    await optionalSetup.locator('summary').click();
  }
}

async function openPanelTab(page, name) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function sendRuntimeMessage(page, message) {
  return page.evaluate((payload) => chrome.runtime.sendMessage(payload), message);
}

async function getDashboard(page) {
  const response = await sendRuntimeMessage(page, { type: 'get-dashboard' });
  return response?.ok ? response.data : null;
}

function buildLiveEnv() {
  return {
    ...process.env,
    ...envFile,
    VITE_PIMLICO_API_KEY: pimlicoApiKey,
    VITE_COOP_CHAIN: 'sepolia',
    VITE_COOP_ONCHAIN_MODE: 'live',
    VITE_COOP_ARCHIVE_MODE: 'mock',
    VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID: workSchemaUid,
    ...(impactSchemaUid
      ? {
          VITE_COOP_GREEN_GOODS_IMPACT_REPORT_SCHEMA_UID: impactSchemaUid,
        }
      : {}),
  };
}

async function launchExtensionProfile(userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });

  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  const page = await context.newPage();
  const cdpSession = await context.newCDPSession(page);

  await cdpSession.send('WebAuthn.enable');
  await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  return {
    context,
    page,
  };
}

function buildCreateGardenPayload(coop) {
  const garden = coop.greenGoods;
  const creator = coop.members[0];
  return {
    coopId: coop.profile.id,
    name: garden?.name || coop.profile.name,
    slug: garden?.slug,
    description: garden?.description || coop.profile.purpose,
    location: garden?.location || undefined,
    bannerImage: garden?.bannerImage || undefined,
    metadata: garden?.metadata || undefined,
    openJoining: garden?.openJoining ?? false,
    maxGardeners: garden?.maxGardeners ?? 0,
    weightScheme: garden?.weightScheme || 'linear',
    domains: garden?.domains || ['agro'],
    ...(creator?.address ? { operatorAddresses: [creator.address] } : {}),
  };
}

test.describe('member account live workflow', () => {
  test.describe.configure({ timeout: 240_000 });

  test.skip(({ isMobile }) => isMobile, 'Extension automation runs only on desktop Chromium.');
  test.skip(
    !runLive || !hasRequiredEnv,
    'Set COOP_RUN_MEMBER_ACCOUNT_LIVE=1 and provide a Pimlico API key to run this Sepolia live spec.',
  );

  test('lazy-deploys the member account on first Green Goods member attestation', async () => {
    const liveAction = await resolveActiveWorkAction(1);

    ensureExtensionBuilt(buildLiveEnv());

    const userDataDir = path.join(os.tmpdir(), `coop-member-live-${Date.now()}`);
    const profile = await launchExtensionProfile(userDataDir);

    try {
      await profile.page.fill('#coop-name', 'Live Garden Coop');
      await profile.page.fill('#coop-purpose', 'Coordinate live Green Goods garden operations.');
      await profile.page.fill('#creator-name', 'Ari');
      await profile.page.fill(
        '#summary',
        'This coop runs a live Green Goods flow with a member smart account.',
      );
      await profile.page.fill(
        '#seed-contribution',
        'I bring the first on-chain garden setup and work submission.',
      );
      await openOptionalSetup(profile.page);
      await profile.page.check('#green-goods-garden');

      await profile.page.getByRole('button', { name: /start this coop/i }).click();
      await expect(profile.page.getByText(/anchor mode is off/i)).toBeVisible({ timeout: 30000 });

      const anchorResult = await sendRuntimeMessage(profile.page, {
        type: 'set-anchor-mode',
        payload: { enabled: true },
      });
      expect(anchorResult?.ok).toBe(true);

      await profile.page.getByRole('button', { name: /start this coop/i }).click();
      await expect(profile.page.getByText(/coop created\./i)).toBeVisible({ timeout: 90000 });

      await openPanelTab(profile.page, 'Nest');
      await expect(profile.page.getByRole('heading', { name: 'Live Garden Coop' })).toBeVisible();

      await expect
        .poll(async () => {
          const dashboard = await getDashboard(profile.page);
          return dashboard?.coops.find(
            (candidate) => candidate.profile.name === 'Live Garden Coop',
          );
        })
        .toBeTruthy();

      const dashboard = await getDashboard(profile.page);
      const coop = dashboard.coops.find(
        (candidate) => candidate.profile.name === 'Live Garden Coop',
      );
      expect(coop).toBeTruthy();
      const creatorMember = coop.members[0];
      expect(coop.onchainState.safeAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      await assertGardenMintAuthorized(coop.onchainState.safeAddress);

      const proposeResponse = await sendRuntimeMessage(profile.page, {
        type: 'propose-action',
        payload: {
          actionClass: 'green-goods-create-garden',
          coopId: coop.profile.id,
          memberId: creatorMember.id,
          payload: buildCreateGardenPayload(coop),
        },
      });
      expect(proposeResponse?.ok).toBe(true);
      const bundleId = proposeResponse?.data?.id;
      expect(bundleId).toBeTruthy();

      const approveResponse = await sendRuntimeMessage(profile.page, {
        type: 'approve-action',
        payload: { bundleId },
      });
      expect(approveResponse?.ok).toBe(true);

      const executeResponse = await sendRuntimeMessage(profile.page, {
        type: 'execute-action',
        payload: { bundleId },
      });
      expect(executeResponse?.ok).toBe(true);

      await expect
        .poll(
          async () => {
            const liveDashboard = await getDashboard(profile.page);
            const liveCoop = liveDashboard?.coops.find(
              (candidate) => candidate.profile.id === coop.profile.id,
            );
            return liveCoop?.greenGoods?.gardenAddress ?? null;
          },
          {
            timeout: 120000,
          },
        )
        .toMatch(/^0x[a-fA-F0-9]{40}$/);

      await profile.page.reload();
      await openPanelTab(profile.page, 'Nest');

      await profile.page.getByRole('button', { name: /provision my garden account/i }).click();
      await expect(
        profile.page.getByText(/member smart account predicted and stored on this browser/i),
      ).toBeVisible({ timeout: 30000 });
      await expect(profile.page.getByText(/address predicted/i)).toBeVisible({ timeout: 30000 });

      if (hasImpactSchema) {
        const impactResponse = await sendRuntimeMessage(profile.page, {
          type: 'submit-green-goods-impact-report',
          payload: {
            coopId: coop.profile.id,
            memberId: creatorMember.id,
            report: {
              title: 'Live Sepolia garden impact report',
              description: 'Baseline impact report submitted from the member smart account.',
              domain: 'agro',
              reportCid: 'bafybeifakeimpactreport1234567890abcdef',
              metricsSummary: JSON.stringify({
                gardeners: 1,
                restoredBeds: 1,
                observation: 'Live Sepolia proof path',
              }),
              reportingPeriodStart: 1704067200,
              reportingPeriodEnd: 1706745600,
            },
          },
        });
        expect(impactResponse?.ok).toBe(true);

        await expect
          .poll(
            async () => {
              const liveDashboard = await getDashboard(profile.page);
              const liveCoop = liveDashboard?.coops.find(
                (candidate) => candidate.profile.id === coop.profile.id,
              );
              return liveCoop?.greenGoods?.lastImpactReportAt ?? null;
            },
            {
              timeout: 120000,
            },
          )
          .toBeTruthy();
      }

      const workResponse = await sendRuntimeMessage(profile.page, {
        type: 'submit-green-goods-work-submission',
        payload: {
          coopId: coop.profile.id,
          memberId: creatorMember.id,
          submission: {
            actionUid: liveAction.actionUid,
            title: `${liveAction.title} - live member proof`,
            feedback: 'Live Sepolia submission from the lazily deployed member smart account.',
            metadataCid: 'bafybeifakeworkmetadata123456789',
            mediaCids: [
              'bafybeifakemediaaaaaaaaaaaaaaaaaaaaaaaaa',
              'bafybeifakemediabbbbbbbbbbbbbbbbbbbbbbbb',
            ],
          },
        },
      });
      expect(workResponse?.ok).toBe(true);

      await expect
        .poll(
          async () => {
            const liveDashboard = await getDashboard(profile.page);
            const liveCoop = liveDashboard?.coops.find(
              (candidate) => candidate.profile.id === coop.profile.id,
            );
            const memberAccount = liveCoop?.memberAccounts.find(
              (account) => account.memberId === creatorMember.id,
            );
            if (!memberAccount || !liveCoop?.greenGoods?.lastWorkSubmissionAt) {
              return null;
            }
            return {
              memberAccount,
              lastWorkSubmissionAt: liveCoop.greenGoods.lastWorkSubmissionAt,
              lastTxHash: liveCoop.greenGoods.lastTxHash,
            };
          },
          {
            timeout: 120000,
          },
        )
        .toBeTruthy();

      const refreshedDashboard = await getDashboard(profile.page);
      const refreshedCoop = refreshedDashboard.coops.find(
        (candidate) => candidate.profile.id === coop.profile.id,
      );
      const memberAccount = refreshedCoop.memberAccounts.find(
        (account) => account.memberId === creatorMember.id,
      );

      expect(memberAccount?.status).toBe('active');
      expect(memberAccount?.deploymentTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(refreshedCoop.greenGoods.lastWorkSubmissionAt).toBeTruthy();
      expect(refreshedCoop.greenGoods.lastTxHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    } finally {
      await closeContextSafely(profile.context);
    }
  });
});
