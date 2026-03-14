import { privateKeyToAccount } from 'viem/accounts';
import {
  deployCoopSafeAccount,
  getCoopChainLabel,
} from '../packages/shared/src/modules/onchain/onchain';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const pimlicoApiKey = process.env.VITE_PIMLICO_API_KEY;
const probePrivateKey = process.env.COOP_ONCHAIN_PROBE_PRIVATE_KEY as `0x${string}` | undefined;
const chainKey = process.env.COOP_ONCHAIN_PROBE_CHAIN === 'arbitrum' ? 'arbitrum' : 'sepolia';

if (!pimlicoApiKey || !probePrivateKey) {
  console.log(
    '[probe:onchain-live] Skipping live Safe probe. Set VITE_PIMLICO_API_KEY and COOP_ONCHAIN_PROBE_PRIVATE_KEY to run a real deployment on Ethereum Sepolia.',
  );
  process.exit(0);
}

const owner = privateKeyToAccount(probePrivateKey);
console.log(
  `[probe:onchain-live] Deploying a probe Safe on ${getCoopChainLabel(chainKey)} with ${owner.address}.`,
);

const state = await deployCoopSafeAccount({
  sender: owner,
  senderAddress: owner.address,
  pimlicoApiKey,
  chainKey,
  coopSeed: `validate:${chainKey}:${Date.now()}`,
});

console.log(`[probe:onchain-live] ${state.statusNote}`);
console.log(`[probe:onchain-live] Safe address: ${state.safeAddress}`);
if (state.deploymentTxHash) {
  console.log(`[probe:onchain-live] Deployment transaction: ${state.deploymentTxHash}`);
}
