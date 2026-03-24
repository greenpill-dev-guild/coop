---
title: Environment Reference
slug: /builder/environment
---

# Environment Reference

Coop uses a single root `.env.local` file. Never create package-specific env files. All `VITE_`
prefixed variables are baked into bundles at build time by Vite -- rebuild after changes.

## Core Configuration

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_CHAIN` | `sepolia`, `arbitrum` | `sepolia` | Target blockchain network |
| `VITE_COOP_ONCHAIN_MODE` | `mock`, `live` | `mock` | Whether onchain operations hit real contracts |
| `VITE_COOP_ARCHIVE_MODE` | `mock`, `live` | `mock` | Whether archive operations use real Storacha/Filecoin |
| `VITE_COOP_SESSION_MODE` | `mock`, `live`, `off` | `off` | Session key and bounded execution mode |
| `VITE_COOP_PRIVACY_MODE` | `on`, `off` | `off` | Enable Semaphore ZK membership proofs |
| `VITE_COOP_PROVIDER_MODE` | `kohaku`, `standard` | `standard` | Onchain provider strategy |
| `VITE_COOP_LOCAL_ENHANCEMENT` | any string, `off` | enabled | Local AI enhancement via WebGPU/WASM (disabled only when set to `off`) |

## Connectivity

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_SIGNALING_URLS` | Comma-separated WSS URLs | `wss://api.coop.town` | Signaling relay endpoints for P2P discovery |
| `VITE_COOP_RECEIVER_APP_URL` | URL | `http://127.0.0.1:3001` | Receiver PWA base URL |
| `VITE_COOP_TURN_URLS` | Comma-separated TURN URIs | -- | TURN relay servers for NAT traversal |
| `VITE_COOP_TURN_USERNAME` | String | -- | TURN authentication username |
| `VITE_COOP_TURN_CREDENTIAL` | String | -- | TURN authentication credential |

## Live Operations

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_PIMLICO_API_KEY` | API key | -- | Pimlico RPC for live Safe/ERC-4337 operations |
| `VITE_PIMLICO_SPONSORSHIP_POLICY_ID` | Policy ID | -- | Pimlico gas sponsorship policy for bundled transactions |

## FVM / Agent Registry (ERC-8004)

These variables configure the Filecoin Virtual Machine integration for on-chain agent registry:

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_FVM_CHAIN` | `filecoin`, `filecoin-calibration` | `filecoin-calibration` | Target FVM network |
| `VITE_COOP_FVM_REGISTRY_ADDRESS` | `0x...` (40-char hex) | -- | ERC-8004 registry contract address |
| `VITE_COOP_FVM_OPERATOR_KEY` | `0x...` (64-char hex) | -- | Operator signing key for registry transactions |

## Green Goods Integration

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_COOP_GREEN_GOODS_WORK_SCHEMA_UID` | `0x...` (64-char hex) | -- | EAS schema UID for Green Goods work attestations |
| `VITE_COOP_GREEN_GOODS_IMPACT_REPORT_SCHEMA_UID` | `0x...` (64-char hex) | -- | EAS schema UID for Green Goods impact report attestations |

## Trusted Node Archive

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

## Development

| Variable | Values | Default | Purpose |
| --- | --- | --- | --- |
| `COOP_TUNNEL_NAME` | Cloudflare tunnel name | -- | Named tunnel identifier for `cloudflared` |
| `COOP_TUNNEL_API_HOSTNAME` | Hostname | -- | Public hostname for the API tunnel (e.g. `dev-api.coop.town`) |
| `COOP_TUNNEL_APP_HOSTNAME` | Hostname | -- | Public hostname for the app tunnel (e.g. `local.coop.town`) |

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

- `bun dev` automatically configures `VITE_COOP_SIGNALING_URLS` and `VITE_COOP_RECEIVER_APP_URL` for the extension build, providing both local and production signaling URLs for fallback.
- TURN credentials are only needed when peers cannot establish direct WebRTC connections (corporate firewalls, symmetric NAT). Without TURN, blob sync falls back to the yws WebSocket relay.
- Trusted node archive variables are only needed by operators running in anchor mode with live archive enabled.
- FVM variables are only needed when interacting with the ERC-8004 on-chain agent registry on Filecoin.
- Green Goods schema UIDs are EAS (Ethereum Attestation Service) identifiers required for garden work and impact report attestations.
