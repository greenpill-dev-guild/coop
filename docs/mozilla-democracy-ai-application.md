# Coop - Mozilla Democracy x AI Incubator Application

## Project Overview

**Proposed Project Title:** Coop

**Project Summary (25 words or less):**
Browser extension with in-browser AI that helps communities turn scattered knowledge into shared intelligence and coordinated action, no cloud platforms required.

**Project Category:** Enable Better Information

**Project Stage:** Working prototype

---

## Your Project

### What technology are you building? How does it address this cohort's theme?

Coop is a browser extension that captures knowledge from everyday browsing and refines it through a 14-skill AI pipeline running entirely in-browser via WebGPU and WebAssembly. No data leaves the device until a human explicitly publishes it.

Each community gets a real multisig account, peer-to-peer sync via CRDTs, and durable archiving to Filecoin. Members review AI-generated drafts together and decide what enters shared memory.

This addresses the cohort's theme directly: AI runs locally so communities don't surrender their information to cloud platforms. The review-and-publish model is inherently democratic. Zero-knowledge proofs let members publish anonymously while proving membership. Peer-to-peer sync means no central server to surveil or shut down.

### Who's part of the community you hope benefits from your project? How are you connecting with them? What community challenge does your project help to address?

We're building for community organizers, bioregional networks, and civic coordination groups who generate valuable research but lose it across scattered tabs, calls, and chat threads.

Our first users are regenerative ecology groups doing agroforestry, waste management, education, and solar development. We've been building with them through Green Goods, running pilot onboarding calls, 1:1 setup sessions, and monthly builder spaces.

The challenge isn't lack of information. It's fragmentation. Research disappears in private tabs. Notes scatter across tools. Communities lose continuity between calls. Evidence lands too late for funding or action. Coop gives them a membrane to gather fragments, review them together, and turn them into shared memory they can act on.

### Describe your project's traction. What's working? What evidence do you have that this technology solves a real problem?

We operate within Regen Coordination, a group of regenerative networks from Greenpill Network, ReFi DAO and Bloom Network doing ecological and civic work across the globe. The coordination challenges are consistent: knowledge fragments across tabs, calls, and threads. Grant deadlines pass because context wasn't surfaced in time. When a key contributor steps away, institutional memory goes with them.

Cloud AI has started closing these gaps, but introduces dependencies: third-party servers, platform terms that change without notice, and connectivity requirements that don't work in infrastructure-limited regions.

Coop brings those same AI patterns into the browser via WebGPU and WebAssembly. Nothing leaves the device until a human publishes it. The working prototype includes a full MV3 extension, 14-skill in-browser AI pipeline, P2P sync via CRDTs, passkey identity with real multisig accounts, and 700+ passing tests. We validated the approach through Green Goods, our impact capture protocol live on Arbitrum, currently piloting structured capture with gardens across agroforestry, waste management, education, and solar development.

---

## Your Team

### Who is building this? What relevant experience does your team have?

I'm a full-stack developer at the intersection of regenerative coordination and decentralized technology. I shipped Green Goods (live on Arbitrum with active gardens) and built the entire Coop stack: browser extension, in-browser ML inference, smart account integration, CRDT peer sync.

Technical depth includes browser extensions (MV3), in-browser ML (WebLLM, Transformers.js), web3 (Safe, ERC-4337, passkey auth), local-first architecture (IndexedDB, Yjs, WebRTC), React, and server infrastructure on Fly.io.

I also leverage advanced AI-assisted development tooling that lets a focused builder maintain the velocity and quality of a larger team. The codebase reflects this: 16+ domain modules, comprehensive test coverage, clean monorepo ready for contributors.

---

## Impact, Openness, and Theme Fit

### What would success look like in 2-3 years? How will you measure success?

Coop becomes the coordination layer communities reach for when they need shared intelligence without defaulting to cloud AI platforms.

Concretely: 50+ active coops running regular capture-and-review cycles. Communities self-onboarding without hand-holding. Local AI surfacing funding opportunities and connecting related work across coops. An open knowledge skill ecosystem where communities contribute domain expertise.

Metrics: weekly active review sessions per coop, artifacts published and acted on, grants identified, community retention across seasons, community-contributed knowledge skills.

### What do you need to make this project sustainable long-term? What are the biggest barriers to getting there?

Community adoption: moving from "works in demo" to "communities depend on it weekly" through dedicated onboarding, facilitator guides, and setup rituals any organizer can run.

Browser AI maturity: small in-browser models (0.5B parameters) are capable but limited. As WebGPU adoption and model efficiency improve, the AI layer gets dramatically more useful without architecture changes.

Sustainable funding: long-term, coops sustain the network through on-chain mechanisms like vault yield and archive fees. Short-term, grants bridge to that future.

Biggest barriers: inference quality at small model sizes, WebGPU device availability, and the cold-start problem of getting first communities into regular use.

### What would $50,000 unlock for your project?

Three things:

Dedicated onboarding for 10-15 pilot communities with structured setup rituals, facilitator training, and sustained support through their first season of capture-and-review cycles.

Knowledge skill ecosystem: build the open SKILL.md protocol and initial skill library so communities contribute domain expertise (grant writing, impact measurement, policy tracking) that the local AI consumes.

Privacy hardening: take ZK membership proofs and stealth addresses from working implementation to production-grade anonymous publishing for communities in sensitive contexts.

This bridges us from working prototype to weekly community use, exactly the gap this incubator closes.

### How will you share your code, learnings, and data with others?

The entire codebase is on GitHub. Coop builds on open standards at every layer: Safe smart accounts, ERC-4337, Yjs CRDTs, Semaphore ZK proofs, Filecoin archiving. Every layer is composable and usable independently by other projects.

We're building SKILL.md as an open standard for community-contributed AI knowledge skills that any compatible agent can consume.

Learnings around browser-native AI inference (WebGPU/WASM model loading, structured output from small models, graceful degradation) are novel and directly applicable to anyone building local-first AI. We'll document these patterns during the cohort.

There's no gated tier. Everything we build is open.

---

## Democratic Impact

### How does your technology actively advance democratic practice?

Participation: the extension captures knowledge during everyday browsing, so quieter members and async contributors feed the commons, not just the most vocal people on calls.

Transparency: every artifact has a provenance chain. The action approval system logs every privileged action. Filecoin archiving creates tamper-evident records independent of any platform.

Accountability: multisig accounts require explicit approval. The policy engine enforces who can do what. Execution permits create auditable delegation with replay protection.

Civic space protection: ZK proofs let members publish without revealing identity. P2P sync means no central server to seize. Local AI means no cloud provider surveilling community sense-making.

### How is AI essential to achieving your democratic impact at scale?

Without AI, community knowledge stays fragmented. The volume of tabs, notes, and captures a community generates is too high for manual processing. Signals get buried.

Coop's in-browser AI extracts opportunities from raw browsing, scores relevance against community goals, clusters related signals across members, drafts review digests, and checks publish-readiness.

Critically, it runs entirely in the browser. Communities in sensitive political contexts can use AI-powered coordination without creating a surveillance surface. The AI serves the community on the community's own device.

Without AI, Coop is a shared bookmarking tool. With it, Coop is a knowledge agent that surfaces what matters, keeps shared memory alive between meetings and help source opportunities aligned with a community.
