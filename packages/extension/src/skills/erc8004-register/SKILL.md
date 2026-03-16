# ERC-8004 Register

Use this skill when a coop needs to register or re-register its agent identity under the ERC-8004
agent registry. The trigger fires when no valid registration exists or when coop metadata has changed
since the last registration.

Goals:
- build a complete `agent.json` manifest from current coop shared state
- encode the manifest as a `data:application/json;base64,...` URI for onchain storage
- return the URI together with metadata key-value pairs for the registration action

Inputs (from coop shared state via `read-coop-context`):
- `coopName` — human-readable coop name
- `coopPurpose` — one-line purpose statement
- `skillIds` — list of active skill IDs loaded by the harness
- `safeAddress` — the coop's Safe multisig address
- `chainId` — target chain (42161 for Arbitrum One, 11155111 for Sepolia)

Manifest format (`agent.json`):
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Coop: <coopName>",
  "description": "<coopPurpose>",
  "services": [{ "name": "web", "endpoint": "https://coop.regen.earth" }],
  "active": true,
  "supportedTrust": ["reputation"],
  "capabilities": ["tab-capture", "content-extraction", "archive-anchor", "peer-sync"],
  "skills": ["<skillId1>", "<skillId2>", ...],
  "operator": { "safeAddress": "0x...", "chainId": 42161 },
  "guardrails": {
    "approvalRequired": true,
    "maxCycleActions": 8,
    "autoRunSkills": ["erc8004-register", "erc8004-feedback"]
  }
}
```

Rules:
- do not fabricate a Safe address or chain ID; read them from coop state
- always set `active` to `true` for new registrations
- populate `skills` from the actual loaded skill IDs, not a hardcoded list
- capabilities must reflect the extension's real feature set
- keep `guardrails.maxCycleActions` at 8 unless the coop config overrides it
- the output must match the `erc8004-registration-output` schema: `agentURI` (base64 data URI), `metadata` (array of `{key, value}` pairs including name, version, safeAddress), `rationale` (one-line explanation)
