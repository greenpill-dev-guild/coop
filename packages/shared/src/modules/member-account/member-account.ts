import { toKernelSmartAccount, toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Address } from 'viem';
import { entryPoint07Address } from 'viem/account-abstraction';
import type {
  AuthSession,
  CoopChainKey,
  LocalMemberSignerBinding,
  Member,
  MemberAccountStatus,
  MemberAccountType,
  MemberOnchainAccount,
} from '../../contracts/schema';
import { localMemberSignerBindingSchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';
import { buildPimlicoRpcUrl, createCoopSaltNonce, getCoopChainConfig } from '../onchain/onchain';
import { createCoopPublicClient } from '../onchain/provider';

// ── Account Creation ─────────────────────────────────────────────────

/** Create a member account record (pre-deployment) */
export function createMemberAccountRecord(input: {
  memberId: string;
  coopId: string;
  ownerPasskeyCredentialId: string;
  chainKey: CoopChainKey;
  accountType?: MemberAccountType;
  accountAddress?: `0x${string}`;
}): MemberOnchainAccount {
  const now = nowIso();

  return {
    id: createId('macct'),
    memberId: input.memberId,
    coopId: input.coopId,
    accountAddress: input.accountAddress,
    accountType: input.accountType ?? 'kernel',
    ownerPasskeyCredentialId: input.ownerPasskeyCredentialId,
    chainKey: input.chainKey,
    status: 'pending',
    statusNote: input.accountAddress
      ? 'Account address recorded, awaiting deployment'
      : 'Account record created, awaiting local provisioning',
    createdAt: now,
    updatedAt: now,
    predictedAt: input.accountAddress ? now : undefined,
  };
}

// ── Status Management ────────────────────────────────────────────────

/** Transition account to deploying status */
export function markAccountDeploying(
  account: MemberOnchainAccount,
  userOperationHash?: `0x${string}`,
): MemberOnchainAccount {
  return {
    ...account,
    status: 'deploying',
    statusNote: 'Deployment transaction submitted',
    userOperationHash: userOperationHash ?? account.userOperationHash,
    updatedAt: nowIso(),
  };
}

/** Record a predicted counterfactual address prior to deployment */
export function markAccountPredicted(
  account: MemberOnchainAccount,
  accountAddress: `0x${string}`,
): MemberOnchainAccount {
  const now = nowIso();
  return {
    ...account,
    accountAddress,
    status: 'predicted',
    statusNote: 'Counterfactual account address predicted and ready for lazy deployment',
    predictedAt: now,
    updatedAt: now,
  };
}

/** Transition account to active after successful deployment */
export function markAccountActive(
  account: MemberOnchainAccount,
  deploymentTxHash: `0x${string}`,
  deployedAccountAddress?: `0x${string}`,
): MemberOnchainAccount {
  const now = nowIso();
  return {
    ...account,
    status: 'active',
    statusNote: 'Account deployed and ready',
    deploymentTxHash,
    accountAddress: deployedAccountAddress ?? account.accountAddress,
    deployedAt: now,
    updatedAt: now,
  };
}

/** Suspend an account */
export function suspendMemberAccount(
  account: MemberOnchainAccount,
  reason: string,
): MemberOnchainAccount {
  const now = nowIso();
  return {
    ...account,
    status: 'suspended',
    statusNote: reason,
    suspendedAt: now,
    updatedAt: now,
  };
}

/** Reactivate a suspended account */
export function reactivateMemberAccount(account: MemberOnchainAccount): MemberOnchainAccount {
  return {
    ...account,
    status: 'active',
    statusNote: 'Account reactivated',
    suspendedAt: undefined,
    updatedAt: nowIso(),
  };
}

/** Enter recovery mode */
export function markAccountRecovery(
  account: MemberOnchainAccount,
  reason: string,
): MemberOnchainAccount {
  return {
    ...account,
    status: 'recovery',
    statusNote: reason,
    updatedAt: nowIso(),
  };
}

// ── Status Computation ──────────────────────────────────────────────

/** Compute the effective status of a member account */
export function computeMemberAccountStatus(account: MemberOnchainAccount): MemberAccountStatus {
  if (account.suspendedAt && account.status !== 'active') return 'suspended';
  if (account.deployedAt && account.status !== 'suspended') return 'active';
  return account.status;
}

/** Check if account is ready for on-chain actions */
export function isMemberAccountReady(account: MemberOnchainAccount): boolean {
  return account.status === 'active' && !!account.deployedAt;
}

/** Check if account needs deployment */
export function isMemberAccountPending(account: MemberOnchainAccount): boolean {
  return account.status === 'pending' || account.status === 'predicted';
}

// ── Provisioning Helpers ─────────────────────────────────────────────

/** Resolve which members need account provisioning */
export function resolveMembersNeedingAccounts(
  members: Member[],
  existingAccounts: MemberOnchainAccount[],
): Member[] {
  const accountedMemberIds = new Set(existingAccounts.map((a) => a.memberId));
  return members.filter((m) => !accountedMemberIds.has(m.id));
}

/** Create account records for all unprovisioned members */
export function provisionMemberAccounts(input: {
  members: Member[];
  existingAccounts: MemberOnchainAccount[];
  coopId: string;
  chainKey: CoopChainKey;
  accountType?: MemberAccountType;
}): MemberOnchainAccount[] {
  const needAccounts = resolveMembersNeedingAccounts(input.members, input.existingAccounts);

  return needAccounts
    .filter((member) => !!member.passkeyCredentialId)
    .map((member) =>
      createMemberAccountRecord({
        memberId: member.id,
        coopId: input.coopId,
        ownerPasskeyCredentialId: member.passkeyCredentialId as string,
        chainKey: input.chainKey,
        accountType: input.accountType,
      }),
    );
}

/** Find member account by member ID */
export function findMemberAccount(
  accounts: MemberOnchainAccount[],
  memberId: string,
): MemberOnchainAccount | undefined {
  return accounts.find((a) => a.memberId === memberId);
}

/** Find member account by account address */
export function findMemberAccountByAddress(
  accounts: MemberOnchainAccount[],
  address: string,
): MemberOnchainAccount | undefined {
  return accounts.find((a) => a.accountAddress?.toLowerCase() === address.toLowerCase());
}

/** Get all active member accounts for a coop */
export function getActiveMemberAccounts(
  accounts: MemberOnchainAccount[],
  coopId: string,
): MemberOnchainAccount[] {
  return accounts.filter((a) => a.coopId === coopId && a.status === 'active');
}

// ── Formatting ───────────────────────────────────────────────────────

/** Human-readable status label */
export function formatMemberAccountStatus(status: MemberAccountStatus): string {
  const labels: Record<MemberAccountStatus, string> = {
    pending: 'Pending provisioning',
    predicted: 'Address predicted',
    deploying: 'Deploying',
    active: 'Active',
    suspended: 'Suspended',
    recovery: 'Recovery in progress',
    error: 'Provisioning error',
  };
  return labels[status] ?? status;
}

/** Human-readable account type label */
export function formatMemberAccountType(type: MemberAccountType): string {
  const labels: Record<MemberAccountType, string> = {
    safe: 'Safe smart account',
    kernel: 'Kernel smart account',
    'smart-account': 'Generic smart account',
  };
  return labels[type] ?? type;
}

/** Create the local signer binding stored only on the member's device. */
export function createLocalMemberSignerBinding(input: {
  coopId: string;
  memberId: string;
  accountAddress: `0x${string}`;
  accountType?: MemberAccountType;
  passkeyCredentialId: string;
  createdAt?: string;
}): LocalMemberSignerBinding {
  const timestamp = input.createdAt ?? nowIso();
  return localMemberSignerBindingSchema.parse({
    id: createId('msigner'),
    coopId: input.coopId,
    memberId: input.memberId,
    accountAddress: input.accountAddress,
    accountType: input.accountType ?? 'kernel',
    passkeyCredentialId: input.passkeyCredentialId,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  });
}

/** Predict the counterfactual account address for a member's smart account. */
export async function predictMemberAccountAddress(input: {
  authSession: AuthSession;
  coopId: string;
  memberId: string;
  chainKey: CoopChainKey;
  accountType?: MemberAccountType;
}): Promise<`0x${string}`> {
  const accountType = input.accountType ?? 'kernel';
  const owner = restorePasskeyAccount(input.authSession);
  const publicClient = await createCoopPublicClient(input.chainKey);

  if (accountType === 'safe') {
    const account = await toSafeSmartAccount({
      client: publicClient,
      owners: [owner],
      version: '1.4.1',
      saltNonce: createCoopSaltNonce(`member-account:${input.coopId}:${input.memberId}`),
    });
    return account.address;
  }

  // Kernel v0.3.1 with EntryPoint 0.7 (default for member accounts)
  const account = await toKernelSmartAccount({
    client: publicClient,
    version: '0.3.1',
    owners: [owner],
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7',
    },
  });
  return account.address;
}

export async function sendTransactionViaMemberAccount(input: {
  authSession: AuthSession;
  pimlicoApiKey: string;
  chainKey: CoopChainKey;
  accountAddress: Address;
  accountType?: MemberAccountType;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) {
  const accountType = input.accountType ?? 'kernel';
  const owner = restorePasskeyAccount(input.authSession);
  const publicClient = await createCoopPublicClient(input.chainKey);

  const account =
    accountType === 'safe'
      ? await toSafeSmartAccount({
          client: publicClient,
          owners: [owner],
          address: input.accountAddress,
          version: '1.4.1',
        })
      : await toKernelSmartAccount({
          client: publicClient,
          version: '0.3.1',
          owners: [owner],
          address: input.accountAddress,
          entryPoint: {
            address: entryPoint07Address,
            version: '0.7',
          },
        });

  const chainConfig = getCoopChainConfig(input.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.chainKey, input.pimlicoApiKey);
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  const txHash = await smartClient.sendTransaction({
    to: input.to,
    data: input.data,
    value: input.value ?? 0n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    receipt,
    accountAddress: account.address,
  };
}
