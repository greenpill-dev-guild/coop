#!/usr/bin/env bun

import {
  getFvmChainConfig,
  inspectFvmRegistryDeployment,
  resolveFvmRegistryAddress,
} from '../packages/shared/src';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const chainKey =
  process.env.COOP_FVM_REGISTRY_PROBE_CHAIN === 'filecoin'
    ? 'filecoin'
    : process.env.VITE_COOP_FVM_CHAIN === 'filecoin'
      ? 'filecoin'
      : 'filecoin-calibration';
const configuredRegistryAddress =
  process.env.COOP_FVM_REGISTRY_PROBE_REGISTRY_ADDRESS ??
  process.env.VITE_COOP_FVM_REGISTRY_ADDRESS;
const rpcUrl = process.env.COOP_FVM_REGISTRY_PROBE_RPC_URL;

const chainConfig = getFvmChainConfig(chainKey);
const registryAddress = resolveFvmRegistryAddress(chainKey, configuredRegistryAddress);

if (!registryAddress) {
  throw new Error(
    `[probe:fvm-registry-live] No registry address is configured for ${chainConfig.label}. Set VITE_COOP_FVM_REGISTRY_ADDRESS or COOP_FVM_REGISTRY_PROBE_REGISTRY_ADDRESS before validating the deployment handoff.`,
  );
}

console.log(
  `[probe:fvm-registry-live] Inspecting CoopRegistry ${registryAddress} on ${chainConfig.label}.`,
);

const inspection = await inspectFvmRegistryDeployment({
  chainKey,
  registryAddress,
  rpcUrl,
});

if (!inspection.ok) {
  throw new Error(`[probe:fvm-registry-live] ${inspection.detail}`);
}

console.log(`[probe:fvm-registry-live] ${inspection.detail}`);
console.log(
  `[probe:fvm-registry-live] Zero-address archive count probe returned ${inspection.archiveCount ?? 0n}.`,
);
