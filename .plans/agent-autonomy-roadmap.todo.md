# Agent Autonomy & On-Chain Infrastructure Roadmap
> Generated from oracle audit 2026-03-22. Prioritized by impact × effort.

## Phase 1: Quick Wins (hours, hackathon-scope)

### 1.1 Enable `memory-insight-due` trigger emission
- [ ] Add emission logic in `syncAgentObservations()` — emit after 5+ new memories or 3+ days
- **Files:** `packages/shared/src/modules/agent/agent.ts`
- **Impact:** Brings `memory-insight-synthesizer` skill to life (currently dead code)
- **Status:** In progress

### 1.2 Wire human review feedback → agent memory
- [ ] In plan approval/rejection handlers, call `createAgentMemory(type: 'user-feedback')`
- [ ] In draft accept/dismiss handlers, call `createAgentMemory(type: 'user-feedback')`
- **Files:** `packages/extension/src/background/handlers/agent.ts`, `packages/shared/src/modules/agent/agent.ts`
- **Impact:** Agent learns from human decisions, improves future skill outputs
- **Status:** In progress

### 1.3 Enable session mode for demo
- [ ] Add `VITE_COOP_SESSION_MODE=live` to `.env.local`
- [ ] Rebuild extension
- [ ] Issue session capability via Nest → Operator Console → Garden Passes
- [ ] Toggle `approvalRequired: false` for Green Goods action classes
- **Impact:** Shows fully autonomous on-chain execution with session keys — zero human interaction for 4 Green Goods actions
- **No code changes needed — configuration only**

## Phase 2: On-Chain Reactivity (1-2 weeks, high value)

### 2.1 On-chain event polling
- [ ] Add periodic polling (30s) for Safe `ExecutionSuccess` events
- [ ] Add polling for ERC-8004 `Registered` and `FeedbackGiven` events
- [ ] Emit agent observations when on-chain events detected (new trigger types needed)
- [ ] Handle external Safe owner changes (sync local state)
- **Files:** New file in `packages/shared/src/modules/onchain/event-poller.ts`, wire into `packages/extension/src/background/alarm-dispatch.ts`
- **Impact:** Closes the biggest gap — agent can react to on-chain state changes from other parties
- **Contracts to watch:**
  - Safe: `ExecutionSuccess`, `AddedOwner`, `RemovedOwner`, `ChangedThreshold`
  - ERC-8004 Identity: `Registered(agentId, owner)` at `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  - ERC-8004 Reputation: `FeedbackGiven(fromAgentId, toAgentId, value)` at `0x8004B663056A597Dffe9eCcC1965A193B7388713`
  - Green Goods: Garden creation events at `0x3e0DE15Ad3D9fd0299b6811247f14449eb866A39`

### 2.2 Batch UserOperations for multi-step flows
- [ ] Combine garden creation + domain setting + pool creation into one batched UserOp
- [ ] Use `sendUserOperation` with multiple `calls` instead of 3 separate `sendTransaction`
- **Files:** `packages/shared/src/modules/greengoods/greengoods.ts`, `packages/extension/src/background/handlers/action-executors.ts`
- **Impact:** 3 txns → 1, faster and cheaper. Better UX for garden setup flow.

### 2.3 Wire Semaphore identity to action authority
- [ ] Map actions to `semaphore-identity` authority class (currently empty array)
- [ ] Candidates: anonymous feedback, anonymous voting, anonymous signaling
- [ ] Wire Semaphore group proof verification in action executor
- **Files:** `packages/shared/src/modules/onchain/authority.ts`, `packages/shared/src/modules/privacy/`
- **Impact:** Enables privacy-preserving agent actions (anonymous publish is already in privacy module)

## Phase 3: Agent Intelligence (2-4 weeks)

### 3.1 Semantic memory retrieval (v2 spec Phase 4)
- [ ] Integrate MiniLM-L6-v2 embeddings for memory similarity search
- [ ] Replace recency-only queries with relevance-ranked retrieval
- [ ] Embed memory content at creation time, store vectors in Dexie
- [ ] Update `queryMemoriesForSkill()` to use cosine similarity
- **Files:** `packages/shared/src/modules/agent/memory.ts`, new embedding utility
- **Impact:** Skills get contextually relevant memories instead of just recent ones

### 3.2 Capture-on-navigate trigger
- [ ] Add `captureOnNavigate` mode in tab change listener
- [ ] Emit immediate extract → route on significant navigation events
- [ ] Deduplicate against recent captures (URL + timestamp window)
- **Files:** `packages/extension/src/background/handlers/capture.ts`
- **Impact:** Real-time knowledge capture instead of batch-only roundups
- **Note:** `captureOnClose` preference exists at `capture.ts:294` — follow same pattern

### 3.3 Peer-sync-received observation trigger
- [ ] Emit `peer-sync-received` when Yjs peer sync brings new shared artifacts
- [ ] Trigger opportunity extraction and entity extraction on incoming peer data
- [ ] Add new trigger type to schema enum
- **Files:** `packages/shared/src/contracts/schema.ts`, Yjs sync handlers, `packages/shared/src/modules/agent/agent.ts`
- **Impact:** Agent processes knowledge from coop members, not just local captures

### 3.4 Confidence decay and re-evaluation
- [ ] Add staleness score to drafts based on time since scoring + context changes
- [ ] Re-score drafts when: new members join, coop soul changes, new artifacts land
- [ ] Emit `draft-confidence-stale` observation trigger
- **Files:** `packages/shared/src/modules/agent/agent.ts`, `packages/extension/src/runtime/agent-quality.ts`
- **Impact:** Drafts stay relevant as context evolves

### 3.5 Configurable review digest cadence
- [ ] Parse `weeklyReviewCadence` string in schema (currently stored but not used)
- [ ] Support daily, weekly, bi-weekly cadences
- [ ] Update `ritual-review-due` check in `syncAgentObservations()`
- **Files:** `packages/shared/src/modules/agent/agent.ts`
- **Impact:** Users can tune digest frequency to their workflow

### 3.6 Knowledge skill trigger-pattern matching
- [ ] Complete wiring so fetched SKILL.md files (via `fetchKnowledgeSkill()`) participate in the pipeline
- [ ] Match incoming observations against dynamically loaded skill trigger patterns
- [ ] Add knowledge skills to DAG sort alongside static skills
- **Files:** `packages/extension/src/runtime/agent-registry.ts`, `packages/extension/src/runtime/agent-harness.ts`, `packages/extension/src/runtime/agent-knowledge.ts`
- **Impact:** Extensible skill pipeline — coops can share custom skills

## Phase 4: Safe Module Ecosystem (3-6 weeks)

### 4.1 Safe Guard module
- [ ] Implement a basic guard that rate-limits transaction types per time window
- [ ] Deploy guard contract on Sepolia
- [ ] Install via Safe module manager
- **Impact:** Defense-in-depth for autonomous agent execution

### 4.2 Safe Allowance module
- [ ] Per-token spending limits for session key actions
- [ ] Time-windowed budgets (e.g., max 0.1 ETH per day via session key)
- **Impact:** Financial guardrails for autonomous on-chain actions

### 4.3 Safe Social Recovery via Semaphore
- [ ] Recovery module that accepts Semaphore group membership proof
- [ ] Combines two existing systems (Safe + Semaphore v4)
- [ ] Threshold of N-of-M Semaphore members can recover Safe access
- **Impact:** Novel recovery pattern, no external wallet needed

### 4.4 Conditional paymasters
- [ ] Sponsor only specific action classes
- [ ] Enforce per-session spending caps at paymaster level
- [ ] Require session key presence for sponsorship
- **Files:** Pimlico paymaster configuration
- **Impact:** Gas cost control for autonomous execution

## Phase 5: Ecosystem Integration (roadmap)

### 5.1 Olas (Autonolas) agent service registration
- [ ] Register Coop agents as Olas services
- [ ] Mint service NFTs for coop agent identities
- [ ] Enable cross-protocol discovery via Olas registry
- [ ] Explore Olas staking for economic security
- **Impact:** Inter-protocol agent coordination, discoverability

### 5.2 ERC-8004 agent discovery
- [ ] Deploy Ponder/Subgraph indexer for ERC-8004 registries
- [ ] Enable agent lookup by capabilities, skills, coop affiliation
- [ ] Service endpoint resolution for cross-coop communication
- **Impact:** Agents can find and interact with each other

### 5.3 Agent-to-agent messaging
- [ ] Use ERC-8004 service endpoints + existing signaling server
- [ ] Define message protocol for inter-coop agent communication
- [ ] Candidates: resource sharing, collaborative opportunity extraction, cross-coop digest
- **Impact:** Multi-agent coordination across coops

### 5.4 MPC/TEE for confidential agent computation
- [ ] Explore TEE enclaves for running inference on shared-but-private data
- [ ] MPC for multi-party credential generation without revealing individual keys
- **Impact:** Privacy-preserving multi-agent intelligence

---

## Current Architecture Reference

### Skill Pipeline (16 skills)
| Autonomy | Skills |
|----------|--------|
| Fully autonomous | tab-router, opportunity-extractor, ecosystem-entity-extractor, theme-clusterer, grant-fit-scorer, gg-garden-bootstrap, gg-garden-sync, gg-gap-admin-sync, erc8004-register, erc8004-feedback |
| Draft for review | capital-formation-brief, memory-insight-synthesizer, review-digest |
| Requires approval | publish-readiness-check, gg-work-approval, gg-assessment |

### On-Chain Stack
| Layer | Technology | Status |
|-------|-----------|--------|
| Collective identity | Safe v1.4.1 | Production |
| Member accounts | Kernel v0.3.1 (ZeroDev) | Production |
| Gas abstraction | ERC-4337 + Pimlico | Production |
| Delegated execution | Rhinestone Smart Sessions | Production (gate: SESSION_MODE=live) |
| Agent registry | ERC-8004 | Production (Sepolia + Arbitrum) |
| Attestations | EAS | Production |
| Privacy identity | Semaphore v4 | Partial (no actions mapped) |

### Contract Addresses (Sepolia)
- Safe factory: standard Safe v1.4.1 deployment
- Garden Token: `0x3e0DE15Ad3D9fd0299b6811247f14449eb866A39`
- Action Registry: `0xB768203B1A3e3d6FaE0e788d0f9b99381ecB3Bae`
- Gardens Module: `0xa3938322bCc723Ff89fA8b34873ac046A7B8C837`
- Karma GAP Module: `0x329916F4598eB55eE9D70062Afbf11312c7F6E48`
- EAS: `0xC2679fBD37d54388Ce493F1DB75320D236e1815e`
- ERC-8004 Identity: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ERC-8004 Reputation: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

### Settings Exposed in UI (Nest tab)
- Approval Rules: per-action-class toggles
- Trusted Helpers: per-skill auto-run toggles
- Garden Passes: TTL + usage limit + issue/revoke
- Agent cadence: 4-64 min dropdown
- Capture on close: toggle
- Local helper (inference): toggle
