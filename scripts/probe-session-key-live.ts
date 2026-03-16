import {
  installModule as buildModuleInstallExecutions,
  isModuleInstalled,
} from '@rhinestone/module-sdk/account';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  buildEnableSessionExecution,
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildPimlicoRpcUrl,
  buildRemoveSessionExecution,
  buildSmartSession,
  checkSessionCapabilityEnabled,
  createActionBundle,
  createGreenGoodsGarden,
  createPolicy,
  createSessionCapability,
  createSessionSignerMaterial,
  getCoopChainConfig,
  getGreenGoodsDeployment,
  revokeSessionCapability,
  validateSessionCapabilityForBundle,
  wrapUseSessionSignature,
} from '../packages/shared/src';
import { deployCoopSafeAccount } from '../packages/shared/src/modules/onchain/onchain';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const pimlicoApiKey = process.env.VITE_PIMLICO_API_KEY;
const probePrivateKey = process.env.COOP_SESSION_PROBE_PRIVATE_KEY as `0x${string}` | undefined;
const chainKey = process.env.COOP_SESSION_PROBE_CHAIN === 'arbitrum' ? 'arbitrum' : 'sepolia';

if (!pimlicoApiKey || !probePrivateKey) {
  console.log(
    '[probe:session-key-live] Skipping Smart Session probe. Set VITE_PIMLICO_API_KEY and COOP_SESSION_PROBE_PRIVATE_KEY to run a live Sepolia/Arbitrum session-key rehearsal.',
  );
  process.exit(0);
}

const chainConfig = getCoopChainConfig(chainKey);
const bundlerUrl = buildPimlicoRpcUrl(chainKey, pimlicoApiKey);
const owner = privateKeyToAccount(probePrivateKey);
const publicClient = createPublicClient({
  chain: chainConfig.chain,
  transport: http(chainConfig.chain.rpcUrls.default.http[0]),
});
const pimlicoClient = createPimlicoClient({
  chain: chainConfig.chain,
  transport: http(bundlerUrl),
});

console.log(
  `[probe:session-key-live] Deploying probe Safe on ${chainConfig.label} for ${owner.address}.`,
);

const onchainState = await deployCoopSafeAccount({
  sender: owner,
  senderAddress: owner.address,
  pimlicoApiKey,
  chainKey,
  coopSeed: `session-probe:${chainKey}:${Date.now()}`,
});

const ownerAccount = await toSafeSmartAccount({
  client: publicClient,
  owners: [owner],
  address: onchainState.safeAddress as Address,
  version: '1.4.1',
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

const deployment = getGreenGoodsDeployment(chainKey);
const signerMaterial = createSessionSignerMaterial();
let capability = createSessionCapability({
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
    allowedActions: ['green-goods-create-garden'],
    targetAllowlist: {
      'green-goods-create-garden': [deployment.gardenToken],
    },
    maxUses: 2,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    chainKey,
    safeAddress: onchainState.safeAddress,
  },
  sessionAddress: signerMaterial.sessionAddress,
  validatorAddress: signerMaterial.validatorAddress,
  validatorInitData: signerMaterial.validatorInitData,
  statusDetail: 'Probe session key ready for create-garden actions.',
});
capability = {
  ...capability,
  permissionId: buildSmartSession({ capability }).permissionId,
};

const { modules } = buildSmartSession({ capability });
for (const module of [modules.validator, modules.fallback]) {
  const installed = await isModuleInstalled({
    client: publicClient,
    account: {
      address: onchainState.safeAddress as Address,
      type: 'safe',
      deployedOnChains: [chainConfig.chain.id],
    },
    module,
  });
  if (installed) {
    continue;
  }

  const executions = await buildModuleInstallExecutions({
    client: publicClient,
    account: {
      address: onchainState.safeAddress as Address,
      type: 'safe',
      deployedOnChains: [chainConfig.chain.id],
    },
    module,
  });
  for (const execution of executions) {
    await ownerSmartClient.sendTransaction({
      to: execution.to,
      data: execution.data,
      value: execution.value,
    });
  }
}

const initiallyEnabled = await checkSessionCapabilityEnabled({
  client: publicClient,
  capability,
});
if (!initiallyEnabled) {
  const { execution } = buildEnableSessionExecution(capability);
  await ownerSmartClient.sendTransaction({
    to: execution.to,
    data: execution.data,
    value: execution.value,
  });
}

const enabled = await checkSessionCapabilityEnabled({
  client: publicClient,
  capability,
});
if (!enabled) {
  throw new Error('Smart Session could not be enabled on the probe Safe.');
}
console.log('[probe:session-key-live] Smart Session enabled on the probe Safe.');

const allowedPolicy = createPolicy({
  actionClass: 'green-goods-create-garden',
  approvalRequired: false,
});
const allowedBundle = createActionBundle({
  actionClass: 'green-goods-create-garden',
  coopId: 'probe-coop',
  memberId: 'probe-member',
  payload: buildGreenGoodsCreateGardenPayload({
    coopId: 'probe-coop',
    name: `Probe Garden ${Date.now()}`,
    slug: `probe-garden-${Date.now()}`,
    description: 'Live Smart Session validation garden.',
    weightScheme: 'linear',
    domains: ['agro'],
    operatorAddresses: [owner.address],
    gardenerAddresses: [owner.address],
  }),
  policy: allowedPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
const allowedValidation = validateSessionCapabilityForBundle({
  capability,
  bundle: allowedBundle,
  chainKey,
  safeAddress: onchainState.safeAddress,
  pimlicoApiKey,
  hasEncryptedMaterial: true,
});
if (!allowedValidation.ok) {
  throw new Error(`Allowed bundle validation failed unexpectedly: ${allowedValidation.reason}`);
}

const sessionSigner = privateKeyToAccount(signerMaterial.privateKey);
const sessionBaseAccount = await toSafeSmartAccount({
  client: publicClient,
  owners: [sessionSigner],
  address: onchainState.safeAddress as Address,
  version: '1.4.1',
});
const sessionAccount = {
  ...sessionBaseAccount,
  async getStubSignature() {
    const validatorSignature = await sessionBaseAccount.getStubSignature();
    return wrapUseSessionSignature({
      capability,
      validatorSignature,
    });
  },
  async signUserOperation(parameters: Parameters<typeof sessionBaseAccount.signUserOperation>[0]) {
    const validatorSignature = await sessionBaseAccount.signUserOperation(parameters);
    return wrapUseSessionSignature({
      capability,
      validatorSignature,
    });
  },
};
const sessionSmartClient = createSmartAccountClient({
  account: sessionAccount,
  chain: chainConfig.chain,
  bundlerTransport: http(bundlerUrl),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
});

const gardenResult = await createGreenGoodsGarden({
  mode: 'live',
  onchainState,
  coopId: 'probe-coop',
  garden: {
    name: `Probe Garden ${Date.now()}`,
    slug: `probe-garden-${Date.now()}-live`,
    description: 'Live Smart Session validation garden.',
    location: 'Sepolia coop yard',
    openJoining: false,
    weightScheme: 'linear',
    domains: ['agro'],
  },
  gardenerAddresses: [owner.address],
  operatorAddresses: [owner.address],
  liveExecutor: async ({ to, data, value }) => {
    const txHash = await sessionSmartClient.sendTransaction({
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
  },
});
console.log(
  `[probe:session-key-live] Allowed create-garden action succeeded: ${gardenResult.gardenAddress} (${gardenResult.txHash}).`,
);

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
    gardenAddress: gardenResult.gardenAddress,
    title: 'Disallowed assessment',
    description: 'This should never pass session validation.',
    assessmentConfigCid: 'bafybeigdyrzt5sessionprobeconfig',
    domain: 'agro',
    startDate: 1_740_000_000,
    endDate: 1_740_086_400,
    location: 'Sepolia coop yard',
  }),
  policy: rejectedPolicy,
  chainId: chainConfig.chain.id,
  chainKey,
  safeAddress: onchainState.safeAddress,
});
const rejectedValidation = validateSessionCapabilityForBundle({
  capability,
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

const { execution: revokeExecution } = buildRemoveSessionExecution(capability);
await ownerSmartClient.sendTransaction({
  to: revokeExecution.to,
  data: revokeExecution.data,
  value: revokeExecution.value,
});

const stillEnabled = await checkSessionCapabilityEnabled({
  client: publicClient,
  capability,
});
if (stillEnabled) {
  throw new Error('Smart Session still appears enabled after revoke.');
}
const revokedValidation = validateSessionCapabilityForBundle({
  capability: revokeSessionCapability(capability),
  bundle: allowedBundle,
  chainKey,
  safeAddress: onchainState.safeAddress,
  pimlicoApiKey,
  hasEncryptedMaterial: true,
});
if (revokedValidation.ok || revokedValidation.rejectType !== 'revoked') {
  throw new Error('Revoked session key still passed local validation.');
}
console.log('[probe:session-key-live] Smart Session revoked successfully.');
