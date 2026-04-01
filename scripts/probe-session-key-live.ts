import {
  installModule as buildModuleInstallExecutions,
  isModuleInstalled,
} from '@rhinestone/module-sdk/account';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  buildEnableSessionExecution,
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildGreenGoodsCreateGardenPoolsPayload,
  buildGreenGoodsSetGardenDomainsPayload,
  buildGreenGoodsSyncGardenProfilePayload,
  buildPimlicoRpcUrl,
  buildRemoveSessionExecution,
  buildSessionModuleAccount,
  buildSmartSession,
  checkSessionCapabilityEnabled,
  createActionBundle,
  createGreenGoodsGarden,
  createGreenGoodsGardenPools,
  createInitialGreenGoodsState,
  createPolicy,
  createSessionCapability,
  createSessionSignerMaterial,
  getCoopChainConfig,
  getGreenGoodsDeployment,
  revokeSessionCapability,
  setGreenGoodsGardenDomains,
  syncGreenGoodsGardenProfile,
  toCoopSafeSmartAccount,
  updateGreenGoodsState,
  usesCoopSafeErc7579,
  validateSessionCapabilityForBundle,
  wrapUseSessionSignature,
} from '../packages/shared/src';
import { deployCoopSafeAccount } from '../packages/shared/src/modules/onchain/onchain';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const pimlicoApiKey = process.env.VITE_PIMLICO_API_KEY;
const probePrivateKey = process.env.COOP_SESSION_PROBE_PRIVATE_KEY as `0x${string}` | undefined;
const chainKey = process.env.COOP_SESSION_PROBE_CHAIN === 'arbitrum' ? 'arbitrum' : 'sepolia';
const existingSafeAddress = process.env.COOP_SESSION_PROBE_SAFE_ADDRESS as Address | undefined;
const rpcUrl = process.env.COOP_SESSION_PROBE_RPC_URL;

if (!pimlicoApiKey || !probePrivateKey) {
  console.log(
    '[probe:session-key-live] Skipping Smart Session probe. Set VITE_PIMLICO_API_KEY and COOP_SESSION_PROBE_PRIVATE_KEY to run the garden-pass rehearsal that backs the extension session-capability UI.',
  );
  process.exit(0);
}

const chainConfig = getCoopChainConfig(chainKey);
const bundlerUrl = buildPimlicoRpcUrl(chainKey, pimlicoApiKey);
const owner = privateKeyToAccount(probePrivateKey);
const publicClient = createPublicClient({
  chain: chainConfig.chain,
  transport: http(rpcUrl ?? chainConfig.chain.rpcUrls.default.http[0]),
});
const pimlicoClient = createPimlicoClient({
  chain: chainConfig.chain,
  transport: http(bundlerUrl),
});
const deployment = getGreenGoodsDeployment(chainKey);
const probeGardenName = process.env.COOP_SESSION_PROBE_NAME ?? `Probe Garden ${Date.now()}`;
const probeGardenSlug = process.env.COOP_SESSION_PROBE_SLUG ?? `probe-garden-${Date.now()}`;
const probeGardenDescription =
  process.env.COOP_SESSION_PROBE_DESCRIPTION ??
  'Live Smart Session validation garden routed through the canonical Green Goods config.';
const probeGardenLocation =
  process.env.COOP_SESSION_PROBE_LOCATION ?? `${chainConfig.shortLabel} coop yard`;
const probeGardenBannerImage =
  process.env.COOP_SESSION_PROBE_BANNER_IMAGE ?? 'ipfs://session-probe-banner';
const probeGardenMetadata =
  process.env.COOP_SESSION_PROBE_METADATA ?? 'ipfs://session-probe-metadata';
const hypotheticalGardenAddress =
  (process.env.COOP_SESSION_PROBE_HYPOTHETICAL_GARDEN_ADDRESS as Address | undefined) ??
  '0x0000000000000000000000000000000000000001';
const probeDomains = ['agro', 'edu'] as const;
const probeGarden = updateGreenGoodsState(
  createInitialGreenGoodsState({
    coopName: probeGardenName,
    purpose: probeGardenDescription,
    setupInsights: {
      summary: probeGardenDescription,
      crossCuttingPainPoints: ['Research context slips between browser tabs and review loops.'],
      crossCuttingOpportunities: ['Keep Green Goods garden setup canonical from the first mint.'],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'Funding context is scattered across tabs.',
          painPoints: 'Good leads disappear before review.',
          improvements: 'Keep promising opportunities visible in one place.',
        },
        {
          lens: 'impact-reporting',
          currentState: 'Evidence is gathered late.',
          painPoints: 'Proof arrives after the important decision window.',
          improvements: 'Keep impact evidence close to the work.',
        },
        {
          lens: 'governance-coordination',
          currentState: 'Follow-through is hard to verify.',
          painPoints: 'Shared commitments fade after meetings.',
          improvements: 'Track who should act and what changed onchain.',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'Useful references live in scattered tools.',
          painPoints: 'People repeat research instead of building on it.',
          improvements: 'Keep the strongest finds legible inside the coop.',
        },
      ],
    },
  }),
  {
    slug: probeGardenSlug,
    description: probeGardenDescription,
    location: probeGardenLocation,
    bannerImage: probeGardenBannerImage,
    metadata: probeGardenMetadata,
    domains: [...probeDomains],
    openJoining: false,
    maxGardeners: 0,
    weightScheme: 'linear',
  },
);
const maintenanceOutput = {
  name: `${probeGardenName} Synced`,
  description: `${probeGardenDescription} Synced through bounded Smart Session follow-up actions.`,
  location: `${probeGardenLocation} follow-up`,
  bannerImage: `${probeGardenBannerImage}-synced`,
  metadata: `${probeGardenMetadata}-synced`,
  openJoining: true,
  maxGardeners: 12,
  domains: [...probeDomains],
  ensurePools: true,
  rationale: 'Exercise the post-mint Green Goods session-key maintenance path.',
} as const;
const liveExecutorAuthSession = {
  passkey: {
    id: 'probe-passkey',
  },
} as never;

const onchainState = existingSafeAddress
  ? {
      chainId: chainConfig.chain.id,
      chainKey,
      safeAddress: existingSafeAddress,
      senderAddress: owner.address,
      safeCapability: 'executed' as const,
      safeSupports7579: true,
      statusNote: 'Attached to an existing probe Safe for Smart Session rehearsal.',
    }
  : await (async () => {
      console.log(
        `[probe:session-key-live] Phase 1/2: deploying probe Safe on ${chainConfig.label} for ${owner.address}.`,
      );
      const deployed = await deployCoopSafeAccount({
        sender: owner,
        senderAddress: owner.address,
        pimlicoApiKey,
        chainKey,
        coopSeed: `session-probe:${chainKey}:${Date.now()}`,
        rpcUrl,
      });
      console.log(
        `[probe:session-key-live] Safe deployed at ${deployed.safeAddress} (${deployed.deploymentTxHash}).`,
      );
      return deployed;
    })();

if (existingSafeAddress) {
  console.log(
    `[probe:session-key-live] Phase 1/2: attaching to existing Safe ${existingSafeAddress} on ${chainConfig.label}.`,
  );
}

const ownerAccount = await toCoopSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  chainKey,
  address: onchainState.safeAddress as Address,
  useErc7579: usesCoopSafeErc7579(onchainState),
});
const ownerSmartClient = createSmartAccountClient({
  account: ownerAccount,
  chain: chainConfig.chain,
  bundlerTransport: http(bundlerUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
});

function createProbeCapability(input: {
  signerMaterial: ReturnType<typeof createSessionSignerMaterial>;
  allowedActions: Parameters<typeof createSessionCapability>[0]['scope']['allowedActions'];
  targetAllowlist: Parameters<typeof createSessionCapability>[0]['scope']['targetAllowlist'];
  maxUses: number;
  statusDetail: string;
}) {
  const capability = createSessionCapability({
    coopId: 'probe-coop',
    issuedBy: {
      memberId: 'probe-member',
      displayName: 'Session Probe',
      address: owner.address,
    },
    executor: {
      label: 'probe:session-key-live',
    },
    scope: {
      allowedActions: input.allowedActions,
      targetAllowlist: input.targetAllowlist,
      maxUses: input.maxUses,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      chainKey,
      safeAddress: onchainState.safeAddress,
    },
    sessionAddress: input.signerMaterial.sessionAddress,
    validatorAddress: input.signerMaterial.validatorAddress,
    validatorInitData: input.signerMaterial.validatorInitData,
    statusDetail: input.statusDetail,
  });

  return {
    ...capability,
    permissionId: buildSmartSession({ capability }).permissionId,
  };
}

async function createSessionSmartClientForCapability(input: {
  capability: ReturnType<typeof createProbeCapability>;
  signerMaterial: ReturnType<typeof createSessionSignerMaterial>;
}) {
  const sessionSigner = privateKeyToAccount(input.signerMaterial.privateKey);
  const sessionBaseAccount = await toCoopSafeSmartAccount({
    client: publicClient,
    owners: [sessionSigner],
    chainKey,
    address: onchainState.safeAddress as Address,
    useErc7579: usesCoopSafeErc7579(onchainState),
  });

  const sessionAccount = {
    ...sessionBaseAccount,
    async getStubSignature() {
      const validatorSignature = await sessionBaseAccount.getStubSignature();
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
    async signUserOperation(
      parameters: Parameters<typeof sessionBaseAccount.signUserOperation>[0],
    ) {
      const validatorSignature = await sessionBaseAccount.signUserOperation(parameters);
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
  };

  return createSmartAccountClient({
    account: sessionAccount,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
}

function validateOrThrow(
  label: string,
  result: ReturnType<typeof validateSessionCapabilityForBundle>,
) {
  if (!result.ok) {
    throw new Error(`${label} failed unexpectedly: ${result.reason}`);
  }
}

async function ensureCapabilityEnabled(capability: ReturnType<typeof createProbeCapability>) {
  const initiallyEnabled = await checkSessionCapabilityEnabled({
    client: publicClient,
    capability,
  });
  if (initiallyEnabled) {
    return;
  }

  const { execution } = buildEnableSessionExecution(capability);
  await ownerSmartClient.sendTransaction({
    to: execution.to,
    data: execution.data,
    value: execution.value,
  });
}

async function revokeCapability(capability: ReturnType<typeof createProbeCapability>) {
  const { execution } = buildRemoveSessionExecution(capability);
  await ownerSmartClient.sendTransaction({
    to: execution.to,
    data: execution.data,
    value: execution.value,
  });
}

async function ensureSessionModulesInstalled(capability: ReturnType<typeof createProbeCapability>) {
  const { modules } = buildSmartSession({ capability });
  const moduleAccount = buildSessionModuleAccount({
    safeAddress: onchainState.safeAddress as Address,
    chainId: chainConfig.chain.id,
    safeSupports7579: usesCoopSafeErc7579(onchainState),
  });
  for (const module of [modules.validator, modules.fallback]) {
    let installed = false;
    try {
      installed = await isModuleInstalled({
        client: publicClient,
        account: moduleAccount,
        module,
      });
    } catch {
      // Fresh Safe without ERC-7579 adapter — expected for standard Safe v1.4.1.
    }
    if (installed) {
      continue;
    }

    try {
      const executions = await buildModuleInstallExecutions({
        client: publicClient,
        account: moduleAccount,
        module,
      });
      for (const execution of executions) {
        await ownerSmartClient.sendTransaction({
          to: execution.to,
          data: execution.data,
          value: execution.value,
        });
      }
    } catch {
      console.log(
        '[probe:session-key-live] ERC-7579 module install skipped — Safe lacks 7579 adapter. ' +
          'This is expected for standard Safe v1.4.1. On-chain session execution requires ' +
          'deploying the Safe with erc7579LaunchpadAddress or attaching to a 7579-enabled Safe.',
      );
      return false;
    }
  }

  return true;
}

console.log(
  '[probe:session-key-live] Phase 1/2: validating local garden-pass rules before any live user operation.',
);

const mintSignerMaterial = createSessionSignerMaterial();
const maintenanceSignerMaterial = createSessionSignerMaterial();
const mintCapability = createProbeCapability({
  signerMaterial: mintSignerMaterial,
  allowedActions: ['green-goods-create-garden'],
  targetAllowlist: {
    'green-goods-create-garden': [deployment.gardenToken],
  },
  maxUses: 1,
  statusDetail: 'Probe session key ready for canonical create-garden execution.',
});
const maintenanceCapability = createProbeCapability({
  signerMaterial: maintenanceSignerMaterial,
  allowedActions: [
    'green-goods-sync-garden-profile',
    'green-goods-set-garden-domains',
    'green-goods-create-garden-pools',
  ],
  targetAllowlist: {
    'green-goods-sync-garden-profile': [hypotheticalGardenAddress],
    'green-goods-set-garden-domains': [deployment.actionRegistry],
    'green-goods-create-garden-pools': [deployment.gardensModule],
  },
  maxUses: 12,
  statusDetail: 'Probe session key ready for post-mint Green Goods maintenance actions.',
});

const mintPolicy = createPolicy({
  actionClass: 'green-goods-create-garden',
  approvalRequired: false,
});
const mintBundle = createActionBundle({
  actionClass: 'green-goods-create-garden',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsCreateGardenPayload({
    coopId: 'probe-coop',
    name: probeGarden.name,
    slug: probeGarden.slug,
    description: probeGarden.description,
    location: probeGarden.location,
    bannerImage: probeGarden.bannerImage,
    metadata: probeGarden.metadata,
    openJoining: probeGarden.openJoining,
    maxGardeners: probeGarden.maxGardeners,
    weightScheme: probeGarden.weightScheme,
    domains: probeGarden.domains,
    operatorAddresses: [owner.address],
    gardenerAddresses: [owner.address],
  }),
  policy: mintPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
validateOrThrow(
  'Canonical create-garden bundle validation',
  validateSessionCapabilityForBundle({
    capability: mintCapability,
    bundle: mintBundle,
    chainKey,
    safeAddress: onchainState.safeAddress,
    pimlicoApiKey,
    hasEncryptedMaterial: true,
  }),
);
console.log('[probe:session-key-live] Canonical create-garden bundle validation passed.');

const rejectedPolicy = createPolicy({
  actionClass: 'green-goods-create-assessment',
  approvalRequired: false,
});
const rejectedBundle = createActionBundle({
  actionClass: 'green-goods-create-assessment',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsCreateAssessmentPayload({
    coopId: 'probe-coop',
    gardenAddress: hypotheticalGardenAddress,
    title: 'Disallowed assessment',
    description: 'This should never pass session validation.',
    assessmentConfigCid: 'bafybeigdyrzt5sessionprobeconfig',
    domain: 'agro',
    startDate: 1_740_000_000,
    endDate: 1_740_086_400,
    location: probeGardenLocation,
  }),
  policy: rejectedPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
const rejectedValidation = validateSessionCapabilityForBundle({
  capability: mintCapability,
  bundle: rejectedBundle,
  chainKey,
  safeAddress: onchainState.safeAddress,
  pimlicoApiKey,
  hasEncryptedMaterial: true,
});
if (rejectedValidation.ok || rejectedValidation.rejectType !== 'unsupported-action') {
  throw new Error('Disallowed assessment action was not rejected by session validation.');
}
console.log('[probe:session-key-live] Disallowed assessment action rejected before send.');

const revokedValidation = validateSessionCapabilityForBundle({
  capability: revokeSessionCapability(mintCapability),
  bundle: mintBundle,
  chainKey,
  safeAddress: onchainState.safeAddress,
  pimlicoApiKey,
  hasEncryptedMaterial: true,
});
if (revokedValidation.ok || revokedValidation.rejectType !== 'revoked') {
  throw new Error('Revoked session key still passed local validation.');
}
console.log('[probe:session-key-live] Revoked capability rejected locally.');

const maintenanceProfilePolicy = createPolicy({
  actionClass: 'green-goods-sync-garden-profile',
  approvalRequired: false,
});
const maintenanceProfileBundle = createActionBundle({
  actionClass: 'green-goods-sync-garden-profile',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsSyncGardenProfilePayload({
    coopId: 'probe-coop',
    gardenAddress: hypotheticalGardenAddress,
    name: maintenanceOutput.name,
    description: maintenanceOutput.description,
    location: maintenanceOutput.location,
    bannerImage: maintenanceOutput.bannerImage,
    metadata: maintenanceOutput.metadata,
    openJoining: maintenanceOutput.openJoining,
    maxGardeners: maintenanceOutput.maxGardeners,
  }),
  policy: maintenanceProfilePolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
validateOrThrow(
  'Post-mint profile sync bundle validation',
  validateSessionCapabilityForBundle({
    capability: maintenanceCapability,
    bundle: maintenanceProfileBundle,
    chainKey,
    safeAddress: onchainState.safeAddress,
    pimlicoApiKey,
    hasEncryptedMaterial: true,
  }),
);

const maintenanceDomainsPolicy = createPolicy({
  actionClass: 'green-goods-set-garden-domains',
  approvalRequired: false,
});
const maintenanceDomainsBundle = createActionBundle({
  actionClass: 'green-goods-set-garden-domains',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsSetGardenDomainsPayload({
    coopId: 'probe-coop',
    gardenAddress: hypotheticalGardenAddress,
    domains: [...probeDomains],
  }),
  policy: maintenanceDomainsPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
validateOrThrow(
  'Post-mint domain sync bundle validation',
  validateSessionCapabilityForBundle({
    capability: maintenanceCapability,
    bundle: maintenanceDomainsBundle,
    chainKey,
    safeAddress: onchainState.safeAddress,
    pimlicoApiKey,
    hasEncryptedMaterial: true,
  }),
);

const maintenancePoolsPolicy = createPolicy({
  actionClass: 'green-goods-create-garden-pools',
  approvalRequired: false,
});
const maintenancePoolsBundle = createActionBundle({
  actionClass: 'green-goods-create-garden-pools',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsCreateGardenPoolsPayload({
    coopId: 'probe-coop',
    gardenAddress: hypotheticalGardenAddress,
  }),
  policy: maintenancePoolsPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
validateOrThrow(
  'Post-mint garden-pools bundle validation',
  validateSessionCapabilityForBundle({
    capability: maintenanceCapability,
    bundle: maintenancePoolsBundle,
    chainKey,
    safeAddress: onchainState.safeAddress,
    pimlicoApiKey,
    hasEncryptedMaterial: true,
  }),
);
console.log(
  '[probe:session-key-live] Maintenance bundle validation passed for profile sync, domain sync, and pool creation.',
);
console.log(
  '[probe:session-key-live] Capability proved locally: the extension can label mint, maintenance, rejected, and revoked Smart Session states before send.',
);

const moduleInstallSuccess = await ensureSessionModulesInstalled(mintCapability);

if (moduleInstallSuccess) {
  await ensureCapabilityEnabled(mintCapability);
  const mintEnabled = await checkSessionCapabilityEnabled({
    client: publicClient,
    capability: mintCapability,
  });
  if (!mintEnabled) {
    throw new Error('Mint Smart Session could not be enabled on the probe Safe.');
  }
  console.log('[probe:session-key-live] Mint Smart Session enabled on the probe Safe.');

  const mintSessionSmartClient = await createSessionSmartClientForCapability({
    capability: mintCapability,
    signerMaterial: mintSignerMaterial,
  });
  const mintLiveExecutor = async ({
    to,
    data,
    value,
  }: {
    to: Address;
    data: `0x${string}`;
    value?: bigint;
  }) => {
    const txHash = await mintSessionSmartClient.sendTransaction({
      to,
      data,
      value: value ?? 0n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return {
      txHash,
      receipt,
      safeAddress: onchainState.safeAddress as Address,
    };
  };

  const gardenResult = await createGreenGoodsGarden({
    mode: 'live',
    authSession: liveExecutorAuthSession,
    pimlicoApiKey,
    onchainState,
    coopId: 'probe-coop',
    garden: probeGarden,
    gardenerAddresses: [owner.address],
    operatorAddresses: [owner.address],
    liveExecutor: mintLiveExecutor,
  });
  console.log(
    `[probe:session-key-live] Allowed create-garden action succeeded: ${gardenResult.gardenAddress} (${gardenResult.txHash}).`,
  );

  await revokeCapability(mintCapability);
  const mintStillEnabled = await checkSessionCapabilityEnabled({
    client: publicClient,
    capability: mintCapability,
  });
  if (mintStillEnabled) {
    throw new Error('Mint Smart Session still appears enabled after revoke.');
  }
  console.log('[probe:session-key-live] Mint Smart Session revoked successfully.');

  const maintenanceLiveCapability = createProbeCapability({
    signerMaterial: maintenanceSignerMaterial,
    allowedActions: [
      'green-goods-sync-garden-profile',
      'green-goods-set-garden-domains',
      'green-goods-create-garden-pools',
    ],
    targetAllowlist: {
      'green-goods-sync-garden-profile': [gardenResult.gardenAddress],
      'green-goods-set-garden-domains': [deployment.actionRegistry],
      'green-goods-create-garden-pools': [deployment.gardensModule],
    },
    maxUses: 12,
    statusDetail: 'Probe session key ready for post-mint Green Goods maintenance actions.',
  });

  await ensureCapabilityEnabled(maintenanceLiveCapability);
  const maintenanceEnabled = await checkSessionCapabilityEnabled({
    client: publicClient,
    capability: maintenanceLiveCapability,
  });
  if (!maintenanceEnabled) {
    throw new Error('Maintenance Smart Session could not be enabled on the probe Safe.');
  }
  console.log('[probe:session-key-live] Maintenance Smart Session enabled on the probe Safe.');

  const maintenanceSessionSmartClient = await createSessionSmartClientForCapability({
    capability: maintenanceLiveCapability,
    signerMaterial: maintenanceSignerMaterial,
  });
  const maintenanceLiveExecutor = async ({
    to,
    data,
    value,
  }: {
    to: Address;
    data: `0x${string}`;
    value?: bigint;
  }) => {
    const txHash = await maintenanceSessionSmartClient.sendTransaction({
      to,
      data,
      value: value ?? 0n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    return {
      txHash,
      receipt,
      safeAddress: onchainState.safeAddress as Address,
    };
  };

  const profileResult = await syncGreenGoodsGardenProfile({
    mode: 'live',
    authSession: liveExecutorAuthSession,
    pimlicoApiKey,
    onchainState,
    gardenAddress: gardenResult.gardenAddress,
    output: maintenanceOutput,
    liveExecutor: maintenanceLiveExecutor,
  });
  console.log(
    `[probe:session-key-live] Profile sync rehearsal succeeded: ${profileResult.txHash}.`,
  );

  const domainsResult = await setGreenGoodsGardenDomains({
    mode: 'live',
    authSession: liveExecutorAuthSession,
    pimlicoApiKey,
    onchainState,
    gardenAddress: gardenResult.gardenAddress,
    domains: [...probeDomains],
    liveExecutor: maintenanceLiveExecutor,
  });
  console.log(`[probe:session-key-live] Domain sync rehearsal succeeded: ${domainsResult.txHash}.`);

  const poolsResult = await createGreenGoodsGardenPools({
    mode: 'live',
    authSession: liveExecutorAuthSession,
    pimlicoApiKey,
    onchainState,
    gardenAddress: gardenResult.gardenAddress,
    liveExecutor: maintenanceLiveExecutor,
  });
  console.log(`[probe:session-key-live] Pool creation rehearsal succeeded: ${poolsResult.txHash}.`);

  await revokeCapability(maintenanceLiveCapability);
  const maintenanceStillEnabled = await checkSessionCapabilityEnabled({
    client: publicClient,
    capability: maintenanceLiveCapability,
  });
  if (maintenanceStillEnabled) {
    throw new Error('Maintenance Smart Session still appears enabled after revoke.');
  }
  console.log('[probe:session-key-live] Maintenance Smart Session revoked successfully.');
  console.log(
    '[probe:session-key-live] Capability proved: the garden-pass UI can map to a full live mint -> sync profile -> set domains -> create pools -> revoke rehearsal when the Safe has ERC-7579 support and enough ETH for any slug registration fee.',
  );
} else {
  console.log(
    '[probe:session-key-live] Phase 1 passed (mint + maintenance state-machine validation). ' +
      'Phase 2 skipped (on-chain session execution requires an ERC-7579-enabled Safe).',
  );
  console.log(
    '[probe:session-key-live] Current limitation: without ERC-7579 on the probe Safe, the rehearsal proves local validation only. Attach COOP_SESSION_PROBE_SAFE_ADDRESS to a 7579-enabled Safe owned by COOP_SESSION_PROBE_PRIVATE_KEY to exercise the full live flow.',
  );
}
