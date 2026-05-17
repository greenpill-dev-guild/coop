---
title: "Agent Threat Model"
slug: /reference/agent-threat-model
---

# Agent Threat Model

A threat model for Coop's browser-native agent harness, adapted from Vitalik Buterin's
[self-sovereign AI security framework](https://vitalik.eth.limo/general/2026/04/02/secure_llms.html)
(April 2026). That post identifies six threat categories for AI systems that operate on personal
data. Coop's local-first, browser-sandboxed architecture already mitigates several of these by
design — this document maps each threat to our current posture, identifies gaps, and points to
implementation work.

## Threat Categories

### 1. Privacy: LLM Cloud Leakage

**Vitalik's concern**: Cloud model providers receive, store, and can monetize private data.

**Coop posture: Mitigated by design, with model-asset caveats.** Inference is designed to run locally
through browser-hosted providers such as Gemma, WebLLM, Transformers.js, and deterministic
heuristics. Capture content, observations, and skill outputs should not leave the device for model
inference, but local-model assets may still need to be downloaded or cached before offline inference
is available.

**Existing docs**: [Agent Harness — Inference Layer](/reference/agent-harness)

**Gap**: This is a core differentiator but isn't framed as a security property in the harness doc.
Add a "Security Model" section to `agent-harness.md` that explicitly positions local inference as
a privacy boundary, not just a performance choice.

---

### 2. Privacy: Non-LLM Data Leakage

**Vitalik's concern**: Search queries, API calls, and metadata leak user intent even when
inference is local.

**Coop posture: Partially mitigated.** The extension captures browser tabs, receiver media, and
files — all stored locally in IndexedDB via Dexie. Sync uses peer-to-peer (y-webrtc) or
server-assisted Yjs document sync, not cloud storage. Archive goes to Filecoin/Storacha only on
explicit user action.

**Existing docs**: [Knowledge Sharing and Scaling](/reference/knowledge-sharing-and-scaling),
[Privacy and Stealth](/reference/privacy-and-stealth)

**Gap**: No doc maps the complete data flow from capture → local storage → sync → archive and
identifies every point where content could leave the device. The signaling server
(`api.coop.town`) sees connection metadata even if not content — document what it sees and what it
doesn't.

---

### 3. LLM Jailbreaks and Prompt Injection

**Vitalik's concern**: Malicious web content hijacks agent behavior. He cites the OpenClaw
research where "15% of skills contained malicious instructions" injected via web pages the agent
was summarizing, and agents could "modify critical settings without requiring confirmation from a
human."

**Coop posture: Highest-priority gap.** The tab roundup skill processes arbitrary web page content
— the exact attack vector described. A malicious page could embed prompt injection payloads in
invisible text, meta tags, or structured data that gets fed into the skill prompt.

**Existing docs**: [Skills System Deep Dive](/reference/skills-system-deep-dive-2026-03-20),
[Agent Harness — Skill Executor](/reference/agent-harness)

**Current mitigations** (implicit, not documented as security measures):
- Approval modes gate output (advisory/proposal prevent auto-execution)
- Zod schema validation rejects structurally invalid output
- Grammar-constrained generation limits output format
- Small local models (0.5B params) are harder to jailbreak than large frontier models

**Gaps to address**:
- **Input sanitization**: No documented sanitization of tab content before it enters skill prompts.
  Define what gets stripped (script tags, hidden text, prompt-injection markers).
- **System/user prompt isolation**: Document how skill instructions (system prompt) are separated
  from captured content (user content). Ensure the boundary is robust.
- **Blast radius analysis**: If a skill *is* jailbroken, what's the worst outcome per approval
  mode? Advisory = bad data in local DB. Proposal = bad suggestion shown to user. Auto-run = the
  actual risk. Document the blast radius for each.
- **Content provenance tagging**: Mark all externally-sourced content (tab text, receiver media)
  as untrusted in the observation pipeline so skills can apply appropriate skepticism.

---

### 4. LLM Accidents: Unintended Data Exposure

**Vitalik's concern**: The model accidentally sends private data to the wrong channel or publishes
it.

**Coop posture: Partially mitigated.** The approval mode system (advisory → proposal → auto-run)
prevents the agent from publishing to the coop feed without human review. The policy layer
requires explicit approval for publish, archive, and Safe operations.

**Existing docs**: [Policy, Session, Permit](/reference/policy-session-permit),
[Authority Classification](/reference/authority-classification),
[Agentic Interface](/reference/agentic-interface)

**Gap**: The four-layer auth system (policy → session → permit → operator) is documented for
*intentional* actions but not for *accidental* ones. Consider:
- Can a skill output inadvertently include content from a different coop?
- Are observation boundaries enforced per-coop, or could cross-coop data leak into a skill prompt?
- What happens if the agent proposes a publish action and the user approves without reading it?
  (UI friction as a security layer — make the review step meaningful, not a rubber stamp.)

---

### 5. LLM Backdoors in Open-Weight Models

**Vitalik's concern**: Open-weight models are not open-source — training data, process, and
potential backdoors are unverifiable. "A hidden mechanism deliberately trained into the LLM" could
activate under specific conditions.

**Coop posture: Undocumented risk.** The harness can use multiple local model families, including
Gemma, WebLLM-hosted models, and Transformers.js models. No complete documented rationale exists for
why each provider or model is selected, what verification was performed, or what the backdoor risk
posture is.

**Existing docs**: [Alibaba PageAgent Comparison](/reference/alibaba-page-agent-comparison)
(compares agent architectures, not model provenance)

**Gaps to address**:
- **Model selection criteria doc**: Which providers and models are allowed? What alternatives were
  evaluated? What properties matter (license, size, quantization support, WebGPU compatibility,
  instruction following, multimodal support)?
- **Model hash verification**: Pin exact model file hashes in the build config. Verify on load
  that the model hasn't been tampered with.
- **Backdoor risk assessment**: At 0.5B parameters, the capacity for sophisticated backdoors is
  lower than in frontier models, but not zero. Acknowledge the risk and the mitigation (small
  blast radius via approval modes + schema validation).
- **Model upgrade policy**: When switching models, what verification steps are required?

---

### 6. Software Supply Chain Vulnerabilities

**Vitalik's concern**: Third-party dependencies introduce vulnerabilities. Local AI can reduce
reliance on external software over time.

**Coop posture: Partially mitigated.** The extension bundles its runtime dependencies. The
roadmap includes bundling ONNX Runtime WASM from node_modules at build time. MV3 service worker
isolation provides process-level sandboxing.

**Existing docs**: [Agent OS Roadmap — Phase 1B](/reference/agent-os-roadmap)

**Gaps to address**:
- **Dependency audit for agent runtime**: Which npm packages are in the agent's execution path?
  What's the attack surface if one is compromised?
- **Reproducible extension builds**: Can two people building from the same commit produce
  byte-identical output? Vitalik's NixOS argument (reproducible config = auditable state) applies
  directly — a reproducibly-built extension is verifiable by any coop member.
- **CSP and network isolation**: Document the Content Security Policy for the extension. The agent
  should have no ability to make network requests except through explicitly approved channels
  (signaling, Yjs sync, archive upload).

---

## Security Triad

Coop's agent security rests on three reinforcing properties:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   LOCAL INFERENCE          No data leaves device     │
│        ×                   for model inference        │
│   BROWSER SANDBOX          MV3 service worker         │
│        ×                   process isolation          │
│   APPROVAL GATES           Human review before        │
│                            any shared action          │
│                                                      │
│   = Self-sovereign agent with bounded blast radius   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Each layer limits what the others can't prevent:
- Local inference prevents cloud leakage but not jailbreaks
- Browser sandbox prevents arbitrary code execution but not data exfiltration via approved channels
- Approval gates prevent unreviewed actions but not bad data entering the local DB

Together, the worst-case outcome of a successful attack is bad data in the local IndexedDB that
a human would catch during review — not leaked keys, not unauthorized transactions, not published
private data.

## Future Direction: Cooperative Inference Infrastructure

Vitalik proposes a cooperative hardware model: "get together a group of friends, buy a computer
and GPU, put it in a place with a static IP address, and all connect to it remotely." This maps
directly to Coop's cooperative structure.

A coop could collectively own inference hardware, with the operator node running larger local
models (35B+) for the group. This extends the existing `operator` module and trusted-node
architecture. Members get better inference quality while the coop retains data sovereignty — no
cloud provider in the loop.

**Related docs**: [Agent OS Roadmap](/reference/agent-os-roadmap) (Phase 2+ kernel extraction
enables portable inference backends), [ERC-8004](/reference/erc8004-and-api) (on-chain agent
identity could attest to inference provenance)

## Implementation Priorities

| Priority | Work Item | Threat Addressed |
|----------|-----------|------------------|
| **P0** | Document prompt injection defense for tab roundup skill | Jailbreaks (#3) |
| **P0** | Add "Security Model" section to `agent-harness.md` | All — framing |
| **P1** | Model selection criteria and hash pinning | Backdoors (#5) |
| **P1** | Data flow map: capture → storage → sync → archive | Leakage (#2) |
| **P1** | Blast radius analysis per approval mode | Accidents (#4) |
| **P2** | Input sanitization spec for externally-sourced content | Jailbreaks (#3) |
| **P2** | Reproducible extension build verification | Supply chain (#6) |
| **P2** | Agent runtime dependency audit | Supply chain (#6) |
| **P3** | Cooperative inference infrastructure design | Future direction |

## References

- Vitalik Buterin, ["Making Ethereum Alignment Legible"](https://vitalik.eth.limo/general/2026/04/02/secure_llms.html), April 2026
- [Browser-Native Agent Harness](/reference/agent-harness) — architecture and inference layer
- [Agent OS Roadmap](/reference/agent-os-roadmap) — evolution phases and known issues
- [Policy, Session, Permit](/reference/policy-session-permit) — four-layer authorization
- [Authority Classification](/reference/authority-classification) — action-to-authority mapping
- [Knowledge Sharing and Scaling](/reference/knowledge-sharing-and-scaling) — data flow pipeline
- [Skills System Deep Dive](/reference/skills-system-deep-dive-2026-03-20) — skill inventory and DAG
- [Privacy and Stealth](/reference/privacy-and-stealth) — Semaphore ZK proofs, stealth addresses
- [ERC-8004 and API](/reference/erc8004-and-api) — on-chain agent identity and reputation
- [Claude Code vs Coop Harness](/reference/claude-code-vs-coop-harness) — comparative architecture
