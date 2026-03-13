---
name: web3
user-invocable: false
description: Web3 frontend patterns - viem, Safe SDK, permissionless (ERC-4337), passkey auth, transaction lifecycle. Use for Safe operations, account abstraction, passkey identity, and onchain interactions.
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Web3 Skill

Frontend Web3 integration guide: Safe creation, passkey accounts, ERC-4337 bundlers, and transaction lifecycle.

---

## Activation

When invoked:
- Coop uses **viem + Safe SDK + permissionless** (NOT Wagmi).
- Passkey-first auth via ERC-4337 smart accounts.
- Chain set by `VITE_COOP_CHAIN` (`sepolia` or `arbitrum`).
- Onchain mode controlled by `VITE_COOP_ONCHAIN_MODE` (`mock` or `live`).

## Part 1: Passkey-First Authentication

### Auth Architecture

Coop uses passkey-first identity -- no wallet extension required:

| Mode | Provider | Account Type | Use Case |
|------|----------|-------------|----------|
| **Passkey** | Pimlico + permissionless | Smart Account (ERC-4337) | Primary -- all users |

### Auth Flow

```typescript
import { useAuth } from "@coop/shared";

function AuthGate() {
  const {
    address,             // Address | undefined
    isAuthenticated,
    loginWithPasskey,
    createPasskey,
    signOut,
  } = useAuth();
}
```

### Passkey Smart Accounts

Coop creates smart accounts backed by WebAuthn passkeys:

```typescript
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createSmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";

// Create bundler client
const pimlicoClient = createPimlicoClient({
  transport: http(`https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apiKey}`),
});

// Create smart account from passkey
const account = await toSimpleSmartAccount({
  client: publicClient,
  owner: passkeyOwner,
});

// Create smart account client
const smartAccountClient = createSmartAccountClient({
  account,
  chain: sepolia,
  bundlerTransport: http(`https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apiKey}`),
  paymaster: pimlicoClient,
});
```

## Part 2: Safe Operations

### Safe Creation

Coop creates a Safe for each coop as the shared treasury/governance address:

```typescript
import { createSafe } from "@coop/shared";

// Create a new Safe with members as owners
const safeAddress = await createSafe({
  owners: [creatorAddress, ...memberAddresses],
  threshold: 1, // Number of required confirmations
  chain: currentChain,
});
```

### Safe Transaction Execution

```typescript
import { executeSafeTransaction } from "@coop/shared";

async function executeCoopAction(safeAddress: Address, txData: SafeTransactionData) {
  const result = await executeSafeTransaction({
    safeAddress,
    to: txData.to,
    data: txData.data,
    value: txData.value,
    smartAccountClient, // ERC-4337 client for gas sponsorship
  });

  return result;
}
```

## Part 3: Viem Client Usage

### Public Client (Reading)

```typescript
import { createPublicClient, http } from "viem";
import { sepolia, arbitrum } from "viem/chains";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Read contract state
const result = await publicClient.readContract({
  address: contractAddress,
  abi: contractABI,
  functionName: "balanceOf",
  args: [address],
});
```

### Writing to Contracts

Use the smart account client for writes:

```typescript
// Via smart account (ERC-4337)
const hash = await smartAccountClient.writeContract({
  address: contractAddress,
  abi: contractABI,
  functionName: "transfer",
  args: [recipient, amount],
});

// Wait for receipt
const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

### Transaction Simulation

**Always simulate before sending real transactions:**

```typescript
const { result } = await publicClient.simulateContract({
  address: contractAddress,
  abi: contractABI,
  functionName: "transfer",
  args: [recipient, amount],
  account: smartAccountAddress,
});
```

## Part 4: Chain Configuration

### Supported Networks

| Chain | Network | Usage |
|-------|---------|-------|
| `sepolia` | Sepolia | Default testnet (dev) |
| `arbitrum` | Arbitrum One | Production |

### Chain Resolution

```typescript
import { getChain } from "@coop/shared";

// Resolves from VITE_COOP_CHAIN env var
const chain = getChain(); // sepolia | arbitrum
```

## Part 5: Transaction Lifecycle

### Stage Tracking

```text
+----------+   +-----------+   +-----------+   +---------+
| Preparing |-->| Signing   |-->| Bundling  |-->| Mined   |
+----------+   +-----------+   +-----------+   +---------+
  Build tx      Passkey sign   4337 bundler    On-chain
```

### Error Handling

```typescript
import { categorizeError } from "@coop/shared";

try {
  await smartAccountClient.writeContract(args);
} catch (error) {
  const { category, message } = categorizeError(error);

  if (category === "blockchain") {
    toast.error("Transaction failed. Please try again.");
  } else if (category === "auth") {
    toast.error("Passkey authentication failed.");
  }
}
```

### Common Errors

| Error | Cause | User Message |
|-------|-------|-------------|
| `UserRejectedRequestError` | User cancelled passkey prompt | "Authentication cancelled" |
| `InsufficientFundsError` | Not enough ETH for gas | "Insufficient funds for gas" |
| `AA21 didn't pay prefund` | Bundler rejected UserOp | "Transaction sponsorship failed" |
| `AA25 invalid account nonce` | Nonce mismatch | "Please retry the transaction" |

## Part 6: Mock vs Live Mode

Coop supports mock mode for development without real chain interactions:

```typescript
// Controlled by VITE_COOP_ONCHAIN_MODE env var
if (onchainMode === "mock") {
  // Returns deterministic addresses, no real transactions
  return mockSafeAddress;
} else {
  // Real Safe creation via Pimlico bundler
  return await createRealSafe(params);
}
```

## Anti-Patterns

- **Never use Wagmi hooks** -- Coop uses viem + permissionless directly
- **Never hardcode chain IDs** -- use `VITE_COOP_CHAIN` env var
- **Never skip simulation** -- always validate before sending
- **Never assume EOA** -- all users have smart accounts (passkey)
- **Never bypass mock mode checks** -- respect `VITE_COOP_ONCHAIN_MODE`

## Quick Reference Checklist

### Before Writing Web3 Code

- [ ] Using viem/permissionless (not Wagmi)
- [ ] Passkey flow handled for auth
- [ ] Transaction simulated before broadcast
- [ ] Error handling with `categorizeError()`
- [ ] Mock/live mode respected
- [ ] Chain from `VITE_COOP_CHAIN` env var

## Related Skills

- `error-handling-patterns` -- Error categorization and user messages
- `react` -- State management for transaction UI
- `data-layer` -- Local persistence for transaction state
