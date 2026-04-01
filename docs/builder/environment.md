---
title: Environment Reference
slug: /builder/environment
---

# Environment Reference

Coop uses a single root `.env.local` file. Never create package-specific env files. All `VITE_`
prefixed variables are baked into bundles at build time by Vite -- rebuild after changes.

## Core Runtime Configuration

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_CHAIN` | `sepolia`, `arbitrum` | `sepolia` | Target chain for onchain state and explorer links |
| `VITE_COOP_ONCHAIN_MODE` | `mock`, `live` | `mock` | Whether onchain operations hit live Safe or contract flows |
| `VITE_COOP_ARCHIVE_MODE` | `mock`, `live` | `mock` | Whether archive operations use live trusted-node delegation material |
| `VITE_COOP_SESSION_MODE` | `mock`, `live`, `off` | `off` | Smart Session and bounded execution mode |
| `VITE_COOP_PRIVACY_MODE` | `on`, `off` | `off` | Enable Semaphore-backed privacy flows |
| `VITE_COOP_PROVIDER_MODE` | `kohaku`, `standard` | `standard` | Onchain provider strategy |
| `VITE_COOP_LOCAL_ENHANCEMENT` | any string, `off` | enabled | Local AI enhancement toggle for in-browser analysis |

## Sync And Receiver Configuration

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_SIGNALING_URLS` | Comma-separated ws/wss/http/https URLs | `wss://api.coop.town` | Signaling URLs passed into y-webrtc room setup |
| `VITE_COOP_RECEIVER_APP_URL` | URL | `http://127.0.0.1:3001` | Receiver PWA base URL and receiver-bridge host-permission source |
| `VITE_COOP_TURN_URLS` | Comma-separated TURN URIs | -- | TURN relay servers for NAT traversal |
| `VITE_COOP_TURN_USERNAME` | String | -- | TURN authentication username |
| `VITE_COOP_TURN_CREDENTIAL` | String | -- | TURN authentication credential |

Notes:

- `bun dev` injects `VITE_COOP_RECEIVER_APP_URL` and `VITE_COOP_SIGNALING_URLS` for the extension
  watcher so local dev can point at the active app and API processes.
- `VITE_COOP_RECEIVER_APP_URL` is also used to derive the receiver bridge content-script matches in
  the extension manifest.
- For Chrome Web Store validation, `VITE_COOP_RECEIVER_APP_URL` must be the exact production HTTPS
  receiver origin. `http://127.0.0.1:3001` and `http://localhost` are valid only for local builds.

## Live Onchain Requirements

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_PIMLICO_API_KEY` | API key | -- | Required for live Safe/ERC-4337 and session-key execution |
| `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` | Policy ID | -- | Optional Pimlico gas sponsorship policy |

## Filecoin / ERC-8004 Registry

These variables configure the Filecoin Virtual Machine integration for on-chain agent registry:

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_FVM_CHAIN` | `filecoin`, `filecoin-calibration` | `filecoin-calibration` | Target FVM network |
| `VITE_COOP_FVM_REGISTRY_ADDRESS` | `0x...` (40-char hex) | -- | ERC-8004 registry contract address |
| `VITE_COOP_FVM_OPERATOR_KEY` | `0x...` (64-char hex) | -- | Operator signing key for registry transactions |

Deploy the registry contract with the repo helper, which runs a clean Foundry build/test pass first
and then broadcasts with `forge create --broadcast`:

```bash
bun run deploy:registry --broadcast
bun run deploy:registry --network mainnet --broadcast
```

By default the helper uses the local Foundry keystore account `green-goods-deployer`. Override that
with `--account <name>` or supply `DEPLOYER_PRIVATE_KEY=0x...` when you do not want to use a
keystore signer.

## Green Goods

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID` | `0x...` (64-char hex) | -- | EAS schema UID for Green Goods work attestations |

## Trusted-Node Archive

These variables configure the trusted-node archive workflow when `VITE_COOP_ARCHIVE_MODE=live`:

| Variable | Purpose |
| --- | --- |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_AGENT_PRIVATE_KEY` | Agent signing key for archive operations |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DID` | Storacha space DID |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_DELEGATION_ISSUER` | Delegation issuer identity |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_SPACE_DELEGATION` | Space delegation proof |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_PROOFS` | Additional authorization proofs (JSON array or single string) |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_GATEWAY_URL` | Gateway URL for archive retrieval (default: `https://storacha.link`) |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_ALLOWS_FILECOIN_INFO` | Whether Filecoin info queries are allowed (`true`/`false`) |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_EXPIRATION_SECONDS` | Archive delegation expiration in seconds |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_FILECOIN_WITNESS_RPC_URL` | Optional Lotus/Filecoin JSON-RPC URL for independent sealing witnesses |
| `VITE_COOP_TRUSTED_NODE_ARCHIVE_FILECOIN_WITNESS_RPC_TOKEN` | Optional bearer token for the Filecoin witness RPC |

These values are operator-only and must not ship in a public Chrome Web Store build.

The canonical operational guidance for these values now lives in
[Live Rails Operator Runbook](/reference/live-rails-operator-runbook).

## Development Orchestration

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `COOP_TUNNEL_NAME` | Cloudflare tunnel name | -- | Named tunnel identifier for `cloudflared` |
| `COOP_TUNNEL_API_HOSTNAME` | Hostname | -- | Public hostname for the API tunnel (e.g. `dev-api.coop.town`) |
| `COOP_TUNNEL_APP_HOSTNAME` | Hostname | -- | Public hostname for the app tunnel (e.g. `local.coop.town`) |
| `COOP_DEV_APP_PORT` | Port | `3001` | Local app dev port |
| `COOP_DEV_API_PORT` | Port | `4444` | Local API dev port |
| `COOP_DEV_DOCS_PORT` | Port | `3003` | Local docs dev port |
| `COOP_DEV_EXTENSION_PORT` | Port | `3020` | WXT dev server port |
| `COOP_EXTENSION_SOURCEMAP` | `1` or unset | unset | Build source maps for extension dist when needed |

## Typical Local Setup

```bash
VITE_COOP_CHAIN=sepolia
VITE_COOP_ONCHAIN_MODE=mock
VITE_COOP_ARCHIVE_MODE=mock
VITE_COOP_SESSION_MODE=off
VITE_COOP_RECEIVER_APP_URL=http://127.0.0.1:3001
VITE_COOP_SIGNALING_URLS=ws://127.0.0.1:4444
```

## Notes

- The shared sync layer also uses the API package's base WebSocket document-sync URL
  (`wss://api.coop.town/yws`) under the hood. That base URL is code-configured today rather than
  exposed as a user-set frontend env var.
- TURN credentials are only needed when peers cannot establish direct WebRTC connections.
- Trusted-node archive variables are only needed by operators running with live archive enabled.
- FVM variables are only needed when interacting with the ERC-8004 agent registry on Filecoin.
- `VITE_COOP_FVM_OPERATOR_KEY` is only appropriate for operator-controlled builds. Because all `VITE_`
  variables are baked into the extension bundle, do not set it in a public Chrome Web Store release.
- Green Goods schema UIDs are EAS (Ethereum Attestation Service) identifiers required for the Green Goods work submission flow. Work approval and assessment UIDs ship from the canonical deployment map.
- Green Goods impact reporting is not a direct EAS attestation flow in Coop. The protocol packages impact through Hypercert/Karma GAP workflows instead.
- For current public release status, staged-launch blockers, and the live-rails second gate, read
  [Current Release Status](/reference/current-release-status).
