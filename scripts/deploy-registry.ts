/**
 * Deploy CoopRegistry to Filecoin (Calibration or Mainnet).
 *
 * Usage:
 *   bun run deploy:registry
 *   bun run deploy:registry --broadcast
 *   bun run deploy:registry --network mainnet --broadcast
 *   DEPLOYER_PRIVATE_KEY=0x... bun run deploy:registry --network mainnet --broadcast
 *   bun run deploy:registry --account green-goods-deployer --broadcast
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';

type NetworkName = 'calibration' | 'mainnet';

type DeployConfig = {
  rpcUrl: string;
  chainId: number;
  deploymentFile: string;
  displayName: string;
};

type KeystoreAuth = {
  kind: 'keystore';
  label: string;
  forgeArgs: string[];
};

type PrivateKeyAuth = {
  kind: 'private-key';
  label: string;
  forgeArgs: string[];
};

type AuthConfig = KeystoreAuth | PrivateKeyAuth;

const CONTRACTS_DIR = resolve(fileURLToPath(new URL('../packages/contracts', import.meta.url)));
const DEPLOYMENTS_DIR = resolve(CONTRACTS_DIR, 'deployments');

const NETWORKS: Record<NetworkName, DeployConfig> = {
  calibration: {
    rpcUrl: 'https://api.calibration.node.glif.io/rpc/v1',
    chainId: 314_159,
    deploymentFile: 'filecoin-calibration.json',
    displayName: 'Filecoin Calibration',
  },
  mainnet: {
    rpcUrl: 'https://api.node.glif.io/rpc/v1',
    chainId: 314,
    deploymentFile: 'filecoin-mainnet.json',
    displayName: 'Filecoin Mainnet',
  },
};

const DEFAULT_KEYSTORE_ACCOUNT = 'green-goods-deployer';
const NETWORK_ALIASES: Record<string, NetworkName> = {
  calibration: 'calibration',
  testnet: 'calibration',
  'filecoin-calibration': 'calibration',
  mainnet: 'mainnet',
  filecoin: 'mainnet',
};

function resolveNetworkName(value: string): NetworkName | null {
  return NETWORK_ALIASES[value] ?? null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let network: NetworkName = 'calibration';
  let broadcast = false;
  let account = DEFAULT_KEYSTORE_ACCOUNT;
  let password: string | undefined;
  let passwordFile: string | undefined;
  let rpcUrl: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const nextArg = args[i + 1];
    if (args[i] === '--network' && nextArg) {
      const resolvedNetwork = resolveNetworkName(nextArg);
      if (!resolvedNetwork) {
        console.error(
          `Unknown network: ${nextArg}. Available: ${Object.keys(NETWORK_ALIASES).join(', ')}`,
        );
        process.exit(1);
      }
      network = resolvedNetwork;
      i += 1;
    } else if (args[i] === '--account' && nextArg) {
      account = nextArg;
      i += 1;
    } else if (args[i] === '--password' && nextArg) {
      password = nextArg;
      i += 1;
    } else if (args[i] === '--password-file' && nextArg) {
      passwordFile = nextArg;
      i += 1;
    } else if (args[i] === '--rpc-url' && nextArg) {
      rpcUrl = nextArg;
      i += 1;
    } else if (args[i] === '--broadcast') {
      broadcast = true;
    }
  }

  return { network, broadcast, account, password, passwordFile, rpcUrl };
}

function resolveAuthConfig(input: {
  account: string;
  password?: string;
  passwordFile?: string;
}): AuthConfig {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (privateKey) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      console.error('DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string.');
      process.exit(1);
    }

    return {
      kind: 'private-key',
      label: 'DEPLOYER_PRIVATE_KEY',
      forgeArgs: ['--private-key', privateKey],
    };
  }

  const forgeArgs = ['--account', input.account];
  if (input.password) {
    forgeArgs.push('--password', input.password);
  }
  if (input.passwordFile) {
    forgeArgs.push('--password-file', input.passwordFile);
  }

  return {
    kind: 'keystore',
    label: input.account,
    forgeArgs,
  };
}

async function runForgeCreate(args: string[], cwd: string) {
  const child = Bun.spawn(args, {
    cwd,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let stdout = '';
  let stderr = '';

  const pipeToTerminal = async (
    stream: ReadableStream<Uint8Array> | null,
    collect: (chunk: string) => void,
    writer: (chunk: string) => void,
  ) => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      collect(chunk);
      writer(chunk);
    }
  };

  await Promise.all([
    pipeToTerminal(
      child.stdout,
      (chunk) => {
        stdout += chunk;
      },
      (chunk) => process.stdout.write(chunk),
    ),
    pipeToTerminal(
      child.stderr,
      (chunk) => {
        stderr += chunk;
      },
      (chunk) => process.stderr.write(chunk),
    ),
  ]);

  const exitCode = await child.exited;
  return { exitCode, stdout, stderr };
}

async function main() {
  const { network, broadcast, account, password, passwordFile, rpcUrl } = parseArgs();
  const config = {
    ...NETWORKS[network],
    rpcUrl: rpcUrl ?? NETWORKS[network].rpcUrl,
  };
  const auth = resolveAuthConfig({ account, password, passwordFile });

  console.log('\n  CoopRegistry Deployment');
  console.log(`  Network:   ${config.displayName} (${network}, chain ${config.chainId})`);
  console.log(`  RPC:       ${config.rpcUrl}`);
  console.log(
    `  Signer:    ${
      auth.kind === 'keystore'
        ? `${auth.label} (Foundry keystore)`
        : `${auth.label} (raw private key)`
    }`,
  );
  console.log(`  Mode:      ${broadcast ? 'BROADCAST (live)' : 'dry-run (build + test only)'}\n`);

  // Clean + build to ensure fresh bytecode (Filecoin needs evm_version = "paris")
  console.log('  Cleaning and building contracts...');
  await $`forge clean`.cwd(CONTRACTS_DIR).quiet();
  const build = await $`forge build`.cwd(CONTRACTS_DIR).quiet();
  if (build.exitCode !== 0) {
    console.error('  Build failed:', build.stderr.toString());
    process.exit(1);
  }
  console.log('  Build OK\n');

  // Run tests
  console.log('  Running tests...');
  const test = await $`forge test`.cwd(CONTRACTS_DIR).quiet();
  if (test.exitCode !== 0) {
    console.error('  Tests failed:', test.stderr.toString());
    process.exit(1);
  }
  console.log('  Tests OK\n');

  if (!broadcast) {
    console.log('  Dry-run complete (build + tests passed). Add --broadcast to deploy.\n');
    return;
  }

  // Use forge create directly because forge script --broadcast has been flaky on Filecoin RPCs.
  const forgeArgs = [
    'forge',
    'create',
    'src/CoopRegistry.sol:CoopRegistry',
    '--broadcast',
    '--rpc-url',
    config.rpcUrl,
    ...auth.forgeArgs,
  ];

  console.log(`  Running: ${forgeArgs.join(' ')}\n`);

  const result = await runForgeCreate(forgeArgs, CONTRACTS_DIR);
  const combinedOutput = `${result.stdout}\n${result.stderr}`;

  if (result.exitCode !== 0) {
    console.error('\n  Deployment failed.');
    process.exit(1);
  }

  const deployerAddress = combinedOutput.match(/Deployer:\s*(0x[a-fA-F0-9]{40})/)?.[1];
  const registryAddress = combinedOutput.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/)?.[1];
  const deployTxHash = combinedOutput.match(/Transaction hash:\s*(0x[a-fA-F0-9]{64})/)?.[1] ?? null;

  if (!registryAddress) {
    console.error('\n  Broadcast finished but no deployed address was detected in forge output.');
    console.error('  Refusing to write an incomplete deployment record.');
    process.exit(1);
  }

  const codeResult = Bun.spawnSync(['cast', 'code', registryAddress, '--rpc-url', config.rpcUrl], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const code = codeResult.stdout.toString().trim();
  if (code === '0x' || code.length <= 2) {
    console.error(
      `\n  Deployment output reported ${registryAddress}, but no runtime bytecode was found there.`,
    );
    console.error('  Refusing to write an unverified deployment record.');
    process.exit(1);
  }

  const deployment = {
    registryAddress,
    deployTxHash,
    deployedAt: new Date().toISOString(),
    chainId: config.chainId,
    network,
    rpcUrl: config.rpcUrl,
    deployerAddress: deployerAddress ?? null,
    note:
      auth.kind === 'keystore'
        ? `Deployed via forge create --broadcast with keystore account ${auth.label}`
        : 'Deployed via forge create --broadcast with DEPLOYER_PRIVATE_KEY',
  };
  const deploymentPath = resolve(DEPLOYMENTS_DIR, config.deploymentFile);
  await writeFile(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log('\n  Deployment confirmed.');
  console.log(`  Registry:  ${registryAddress}`);
  if (deployTxHash) {
    console.log(`  Tx hash:   ${deployTxHash}`);
  }
  console.log(`  Saved:     packages/contracts/deployments/${config.deploymentFile}`);
  console.log('\n  Next:');
  console.log(
    `    1. Set VITE_COOP_FVM_CHAIN=${network === 'mainnet' ? 'filecoin' : 'filecoin-calibration'}`,
  );
  console.log(`    2. Set VITE_COOP_FVM_REGISTRY_ADDRESS=${registryAddress}`);
  console.log('    3. Update packages/shared/src/modules/fvm/fvm.ts if this deployment is canonical.');
  console.log('    4. Members will need FIL on their local Filecoin signer address before registering proofs.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
