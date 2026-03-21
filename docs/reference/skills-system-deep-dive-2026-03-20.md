# Coop Skills System Deep Dive

Date: 2026-03-20

## Scope

This memo analyzes Coop's current skill system from four angles:

1. how skills are actually used in the agent loop today
2. how closely the implementation conforms to broader `SKILL.md` conventions used by other agents
3. how modular and scalable the system is for adding more bundled or imported skills
4. how the skill layer connects to Coop's core product loop and feature set

This is based on direct inspection of the extension runtime, shared schemas, current skill folders, operator UI, and existing architecture docs.

## Files Reviewed

- `packages/extension/src/runtime/agent-registry.ts`
- `packages/extension/src/runtime/agent-runner.ts`
- `packages/extension/src/runtime/agent-harness.ts`
- `packages/extension/src/runtime/agent-knowledge.ts`
- `packages/extension/src/runtime/agent-models.ts`
- `packages/extension/src/runtime/agent-output-handlers.ts`
- `packages/extension/src/background/handlers/agent.ts`
- `packages/extension/src/views/Sidepanel/operator-sections.tsx`
- `packages/shared/src/contracts/schema.ts`
- `packages/shared/src/modules/agent/agent.ts`
- `packages/extension/src/skills/*`
- `README.md`
- `docs/reference/agent-harness.md`
- `docs/reference/knowledge-sharing-and-scaling.md`
- `docs/reference/agent-os-roadmap.md`
- `/Users/afo/.codex/skills/.system/skill-creator/SKILL.md`

## Executive Summary

Coop's current skill system is strong as a typed, local-first, product-specific agent harness. It is not yet a fully modular or standards-conformant skill platform in the way Codex-style or Anthropic-style skill systems tend to be.

The key distinction is this:

- Coop has a solid executable skill runtime built around `skill.json`, typed schemas, observation triggers, dependency ordering, and bounded action proposals.
- Coop also has an early external `SKILL.md` import path, but only for read-only knowledge injection, not for executable third-party skills.

The biggest implementation gap is that bundled executable `SKILL.md` files are currently required by the registry but are not actually used by the runner when constructing prompts. In practice, executable skill behavior is driven by:

- `skill.json`
- hard-coded prompt assembly in `agent-runner.ts`
- hard-coded output handling branches in `agent-runner.ts`
- hard-coded schema unions in `@coop/shared`

So today, Coop's "skill system" is best understood as:

- a typed first-party capability graph
- plus an experimental external knowledge-skill layer
- not yet a portable, open skill ecosystem

## Current State

### 1. There are 16 bundled executable skills, not 14

The current `packages/extension/src/skills/` directory contains 16 skill folders:

- `capital-formation-brief`
- `ecosystem-entity-extractor`
- `erc8004-feedback`
- `erc8004-register`
- `grant-fit-scorer`
- `green-goods-assessment`
- `green-goods-gap-admin-sync`
- `green-goods-garden-bootstrap`
- `green-goods-garden-sync`
- `green-goods-work-approval`
- `memory-insight-synthesizer`
- `opportunity-extractor`
- `publish-readiness-check`
- `review-digest`
- `tab-router`
- `theme-clusterer`

Multiple docs still say "14-skill pipeline," including:

- `README.md`
- `CLAUDE.md`
- `docs/reference/agent-harness.md`
- `docs/reference/agent-os-roadmap.md`
- `docs/reference/product-requirements.md`

That documentation drift is small operationally, but important strategically. It makes the system look less settled than it actually is, and it obscures recently added capability surface such as `tab-router` and `memory-insight-synthesizer`.

### 2. The runtime has two different kinds of skills

#### Executable bundled skills

These are loaded at build time from `packages/extension/src/skills/*/skill.json` and `SKILL.md`.

They are:

- typed via Zod
- triggered by `AgentObservation`
- selected by trigger
- ordered by DAG dependencies
- run through the local inference cascade
- converted into drafts or action proposals

#### External knowledge skills

These are fetched from arbitrary URLs that expose a `SKILL.md` document with YAML frontmatter and a markdown body.

They are:

- stored in Dexie
- selected by simple relevance scoring
- injected into prompts as truncated domain knowledge
- not executable
- not exposed as first-class operator-facing skills in the current UI

This split matters. Coop already has the beginnings of interoperability, but only at the knowledge layer, not at the execution layer.

## How Skills Are Used In The Agent Flow

### 1. Observations are the real entry point

Skills do not self-trigger. `AgentObservation` records do.

The background handler emits observations from product state such as:

- tab roundup batches
- high-confidence drafts
- receiver backlog
- ritual review cadence
- stale archive receipts
- Green Goods lifecycle events
- ERC-8004 registration requirements

There is also a runner-side feedback path where tab routing can create follow-on observations like `high-confidence-draft` and `memory-insight-due`.

This means Coop's skill architecture is observation-driven, not agent-command-driven. That is a good fit for Coop's product loop because the "helper" is reacting to knowledge state changes rather than waiting for direct user tool calls.

### 2. Skill selection is clean and deterministic

Skill manifests declare `triggers`, `depends`, `skipWhen`, and `provides`.

The flow is:

1. filter manifests by observation trigger
2. remove skills that do not apply in the current context
3. topologically sort the remaining skills with alphabetical tie-breaking
4. skip skills when simple preconditions fail
5. execute sequentially

The dependency graph is currently shallow and legible:

- `opportunity-extractor -> grant-fit-scorer -> capital-formation-brief`
- `theme-clusterer -> memory-insight-synthesizer`

Everything else is effectively a root skill.

This is one of the stronger parts of the design. The planner is simple enough to stay reliable and the DAG is easy to reason about.

### 3. Execution is still largely hard-wired

After selection, the runner executes each skill sequentially and then branches on `outputSchemaRef`.

That output branch logic is where most real behavior lives:

- candidate persistence
- score propagation
- review draft creation
- draft patching
- Green Goods action proposal shaping
- auto-run dispatch
- memory writing

So the manifest determines which skill runs, but the runner still determines what the skill means operationally.

That is why adding a new skill is not yet "drop in a folder and go." The system remains extensible, but not plug-and-play.

### 4. Operator UI treats skills as trusted helper controls

The sidepanel surfaces skills through:

- `Trusted Helpers`
- `What Helpers Noticed`
- `Helper Plans`
- `Trusted Helper Runs`

This is a good product translation. It keeps the system legible to operators without exposing raw agent internals as the primary UX.

It also shows that skills are not just internal plumbing. They are already part of Coop's operating model:

- they produce observable helper behavior
- they create review drafts
- they queue bounded actions
- they are individually auto-runnable when safe enough

## Conformance To Broader Skill Standards

## Comparator: Codex-style SKILL.md

The local Codex skill standard expects:

- a required `SKILL.md`
- required YAML frontmatter with `name` and `description`
- markdown instructions in the body
- optional progressive-disclosure resources such as `scripts/`, `references/`, and `assets/`
- metadata that can be used to determine when the skill should trigger

Coop partially matches this, but only partially.

### Where Coop aligns

#### 1. Folder-per-skill structure

Bundled skills are modularized as one folder per skill. This aligns with the common skill-as-folder pattern.

#### 2. Separate metadata and instructions

Coop uses:

- `skill.json` for typed machine metadata
- `SKILL.md` for human-readable instructions

That separation is reasonable and arguably better than overloading YAML frontmatter with execution-critical fields.

#### 3. External knowledge skills do follow the basic SKILL.md protocol

`agent-knowledge.ts` explicitly parses `SKILL.md` as:

- YAML frontmatter
- markdown body

and uses `name` and `description` as frontmatter fields. Discovery of sub-skills from a root `SKILL.md` index is also supported.

That means Coop is already speaking a minimal interoperable skill-document format at the knowledge layer.

### Where Coop diverges

#### 1. Bundled executable SKILL.md files are not standards-conformant

Most bundled executable `SKILL.md` files do not include YAML frontmatter at all.

Examples:

- `packages/extension/src/skills/opportunity-extractor/SKILL.md`
- `packages/extension/src/skills/review-digest/SKILL.md`
- `packages/extension/src/skills/memory-insight-synthesizer/SKILL.md`

Under a Codex-style skill loader, these would not qualify as complete skills because the required `name` and `description` metadata is missing from the markdown file itself.

#### 2. Executable SKILL.md files are not actually used by the runner

This is the most important divergence.

The registry eagerly loads both manifests and `SKILL.md` instructions, but the runner's prompt builder uses only:

- `input.manifest.description`
- `input.manifest.outputSchemaRef`
- observation context
- memory context
- optional external knowledge skills

I did not find any runtime path where bundled executable `registered.instructions` is injected into the model prompt.

So right now:

- `SKILL.md` exists
- the registry validates its presence
- tests validate it loads
- but execution does not consume it

That means the system is not yet following the common skill pattern where the markdown file is the primary behavioral contract for the agent.

#### 3. External knowledge skill parsing is intentionally minimal

The knowledge-skill parser only reads:

- `name`
- `description`

It ignores richer frontmatter fields commonly used by other systems, and imported skills default to:

- `domain: "general"`
- `triggerPatterns: []`

unless additional metadata is filled in elsewhere.

This keeps the parser simple, but it also means imported skill semantics are weak compared to more mature skill ecosystems.

#### 4. There is no progressive disclosure for bundled executable skills

Codex-style skill systems assume:

- metadata is always available
- the body is loaded only when needed
- references/scripts/assets are loaded on demand

Coop's executable skills are currently build-time eager-loaded through `import.meta.glob(...)`, and the roadmap explicitly calls out lazy loading as future work.

#### 5. There is no bundled-resource pattern yet

Current Coop skills are almost entirely:

- `skill.json`
- `SKILL.md`

There are no per-skill:

- `scripts/`
- `references/`
- `assets/`

This keeps the current bundle lean, but it also means the system has not yet adopted the richer "skill as self-contained capability pack" model that scales well across teams and domains.

## Practical Conformance Verdict

### Executable bundled skills

Conformance is low to medium.

They follow the folder convention, but not the markdown metadata convention, and the markdown instructions are not first-class runtime inputs.

### External knowledge skills

Conformance is medium.

They genuinely follow a basic `SKILL.md` protocol and can be fetched, parsed, discovered, stored, and injected, but only as passive knowledge.

### Overall

Coop currently conforms more to a custom typed skill-runtime pattern than to a portable `SKILL.md` ecosystem standard.

That is not a flaw by itself. It is just an important truth about the current architecture.

## Modularity And Scalability

### What is modular today

#### 1. Typed manifests

The manifest schema is a strong foundation. Skills can declare:

- runtime
- model
- triggers
- output schema
- approval mode
- timeout
- dependencies
- skip conditions
- provided context labels
- allowed tools
- allowed action classes
- required capabilities
- optional `maxTokens`

This is a serious, extensible contract surface.

#### 2. DAG-based planning

Dependencies are modeled explicitly and cleanly. That makes the skill graph scalable in principle.

#### 3. Shared schema contracts

Every output schema is typed and validated centrally in `@coop/shared`. This is valuable because it keeps skill outputs legible across runtime boundaries and avoids prompt-only coupling.

#### 4. Approval-mode integration

Skills are already integrated into:

- policy
- operator trust
- auto-run toggles
- action proposal execution

That makes them first-class citizens in Coop's governance model.

### What does not scale well yet

#### 1. Adding a new skill still requires touching many places

For a genuinely new executable skill, you likely need to update:

- `packages/shared/src/contracts/schema.ts`
  add trigger enum and/or output schema ref union
- `packages/shared/src/modules/agent/agent.ts`
  register output schema validation and any draft helpers
- `packages/extension/src/skills/<skill-id>/skill.json`
- `packages/extension/src/skills/<skill-id>/SKILL.md`
- `packages/extension/src/runtime/agent-runner.ts`
  add output handling and any side effects
- observation emitters if the trigger is new
- tests
- docs

That is manageable for first-party development, but it is not yet a low-friction extension model.

#### 2. The runtime relies on a large output-schema switch

The repo's own docs already call this out. `agent-output-handlers.ts` exists as a placeholder, but the actual handler registry is not implemented yet.

This is probably the single biggest scalability bottleneck for first-party skill growth.

If Coop wants to keep adding first-party skills rapidly, extracting that switch into a registry is the next structural move.

#### 3. Manifest capability fields are not fully enforced

The manifest includes `allowedTools`, `allowedActionClasses`, `requiredCapabilities`, and `maxTokens`.

Today:

- `allowedTools` is descriptive metadata, not a real tool sandbox
- `allowedActionClasses` is partly aligned with output handling, but not enforced generically
- `requiredCapabilities` is not driving host/runtime gating
- `maxTokens` is defined but not wired into model execution

This is an important distinction: the manifest is ahead of the runtime.

That is good for roadmap direction, but it means the system is less self-describing in practice than it appears on paper.

#### 4. Parallel execution is not implemented

Independent skills are still executed sequentially even when the DAG would allow concurrency.

That does not break correctness, but it reduces the benefit of a more diverse skill graph.

#### 5. Executable skills are not externally pluggable

Knowledge skills can be imported from URLs.
Executable skills cannot.

So Coop is currently scalable in the sense of:

- adding more first-party packaged skills

but not yet in the sense of:

- importing existing third-party skills and trusting them to run
- treating skills as a community ecosystem
- letting coops choose from a portable catalog of executable helpers

#### 6. Knowledge-skill import lacks an operator product surface

The infrastructure exists, but I did not find a user-facing runtime request or sidepanel flow for:

- importing a knowledge skill by URL
- browsing discovered sub-skills
- editing trigger patterns
- refreshing a skill on demand
- per-coop enable/disable management in the UI

So the knowledge-skill system is real in code, but still latent as a product surface.

## Connection To Coop's Core Features

This is where the current system is actually strongest.

## 1. Skills map directly onto the product loop

### Capture -> Refine

These skills turn raw captures or draft signals into structured understanding:

- `tab-router`
- `opportunity-extractor`
- `grant-fit-scorer`
- `ecosystem-entity-extractor`
- `theme-clusterer`

### Refine -> Review

These skills create local review artifacts:

- `capital-formation-brief`
- `review-digest`
- `memory-insight-synthesizer`

### Review -> Share

This skill bridges the Roost into publishing:

- `publish-readiness-check`

That makes the skill layer deeply aligned with Coop's core knowledge workflow rather than sitting off to the side as generic automation.

## 2. Skills power operator and governance features

The skill system is also the mechanism behind bounded operator actions:

- Green Goods garden bootstrap and sync
- work approval
- assessment creation
- GAP admin sync
- ERC-8004 registration
- ERC-8004 reputation feedback

This is important architecturally. It means skills are not just content analysis prompts. They are the bridge between:

- local inference
- typed proposals
- governed execution

That is one of Coop's most distinctive design qualities.

## 3. The current skill model reinforces Coop's local-first stance

The execution path is browser-native and local-first:

- observations in Dexie
- planning in the extension runtime
- model execution through WebLLM / transformers.js / heuristics
- logs in Dexie
- approval in the sidepanel

Even the external knowledge-skill layer preserves this pattern because imported skills are fetched once, cached locally, and then used as prompt context.

So while the skill system is not yet highly portable, it is already strongly aligned with Coop's privacy and local-compute principles.

## 4. The current system reflects Coop's "trusted helper" framing well

The operator console does a good job translating technical skills into product language:

- helpers notice things
- helpers make plans
- helpers run bounded chores
- helpers can be auto-run only when trust and approval settings allow it

That is a stronger UX abstraction than exposing "skills" directly as a tool picker.

## Gaps That Matter Most

These are the highest-signal gaps I found.

### 1. The bundled `SKILL.md` files are not first-class runtime inputs

This is the core architectural inconsistency.

Right now Coop says skills are `skill.json + SKILL.md`, but execution is effectively:

- `skill.json`
- runner prompt template
- output-schema-specific branches

If Coop wants a more legible and portable skill system, this is the first thing to fix.

### 2. The system is extensible, but not yet composable

Adding first-party skills is possible.
Adopting third-party executable skills is not.

That means Coop can grow its own harness, but it is not yet positioned to become a broader skill host.

### 3. The docs oversell standardization slightly

The docs correctly describe the high-level architecture, but they present the system as more convention-driven and more fully skill-centric than the implementation currently is.

The strongest examples:

- 14 vs 16 skill count mismatch
- executable `SKILL.md` files described as instruction-bearing runtime assets, but unused in prompt assembly
- external skill protocol presented as a meaningful extension path, but not yet surfaced as a real product capability

### 4. Evaluation is still missing

The roadmap is explicit about this, and the code supports the concern.

Coop validates structural correctness, not output quality.

That means the system is good at preventing malformed output, but still weak at detecting degraded output quality over time.

### 5. There is already evidence of test/runtime drift

A targeted validation run of `bun run test:unit:agent-loop` currently fails on:

- `packages/extension/src/runtime/__tests__/agent-models.test.ts`

Specifically, the cold-start tab-routing fallback test expects a heuristic result and currently receives `transformers`.

That does not directly break the architecture, but it is a useful signal: the skill/inference surface is already complex enough that behavior can drift away from tests.

## Assessment

### What Coop has today

Coop has a strong first-party, typed, local agent capability graph.

It is well matched to:

- knowledge refinement
- bounded helper automation
- governed onchain and archive actions
- operator trust controls

### What Coop does not yet have

Coop does not yet have a broadly interoperable skill platform where:

- executable skills can be imported from outside the repo
- `SKILL.md` is the primary runtime contract
- skill resources are progressively loaded
- handlers are registry-driven rather than switch-driven
- skill quality is systematically evaluated

### Net judgment

The system is more mature as a productized harness than as a reusable skill platform.

That is a reasonable place to be. It serves Coop's immediate product goals well.

But if the next goal is "skills as a durable extension surface," Coop needs one more architectural turn.

## Recommended Next Moves

These are the most leverageful next steps if the goal is to strengthen the skill system without destabilizing the current product loop.

### 1. Make the docs truthful again

Short-term cleanup:

- update all "14-skill" references to 16
- publish an authoritative current skill inventory
- distinguish clearly between:
  - bundled executable skills
  - imported knowledge skills
  - non-skill special-case automations like stale archive refresh

This is the cheapest improvement and immediately lowers confusion.

### 2. Make executable `SKILL.md` actually matter

Medium-priority architectural change:

- require YAML frontmatter for bundled skills
- add minimal standardized fields like `name`, `description`, and maybe `promptSnippet`
- inject the selected skill's markdown instructions into prompt assembly
- keep `skill.json` for typed runtime data

This would bring the system much closer to the broader skill pattern without sacrificing Coop's typed contracts.

### 3. Extract output handlers into a registry

This is the best scalability move for first-party skill growth.

Goal:

- one handler module per output schema or per skill family
- minimal branching in `agent-runner.ts`
- clearer path for adding new skill types

### 4. Enforce the manifest fields that already exist

Especially:

- `maxTokens`
- `requiredCapabilities`
- `allowedActionClasses`

This would reduce the gap between declarative intent and actual runtime behavior.

### 5. Turn the knowledge-skill layer into a product surface

If the team wants to adopt more existing skills over time:

- add import-by-URL UI
- show imported skills in operator settings
- allow trigger-pattern editing
- allow per-coop enable/disable controls
- expose freshness/refresh state

Without that, knowledge-skill interoperability remains mostly architectural potential.

### 6. Add a real skill evaluation harness

At minimum:

- golden inputs/outputs for each skill
- structural assertions
- a few quality fixtures for synthesis skills

This becomes more important as the skill count grows and as prompts become more compositional.

### 7. Decide deliberately whether Coop wants to be a skill host

There are two valid futures:

#### Path A: First-party skill operating system

Optimize for:

- highly governed Coop-native helpers
- strong typed contracts
- safe product-specific automation

#### Path B: Interoperable skill platform

Optimize for:

- portable `SKILL.md` conformance
- external executable skill loading
- trust levels and sandboxing
- richer resource packaging
- MCP/WebMCP-style tool mapping

Coop can move toward both, but the implementation choices diverge quickly. The team should be explicit about which one is primary.

## Bottom Line

Coop's current skill system is already valuable and real. It is not vapor. It powers core parts of the product:

- refinement
- review synthesis
- routing
- publish readiness
- Green Goods operations
- ERC-8004 identity and reputation

But it is still best described as a tightly integrated first-party harness, not yet as a general-purpose standardized skill ecosystem.

If the goal is to deepen Coop's own helper intelligence, the current architecture is solid.
If the goal is to make skills portable, adopt existing skill libraries, and let coops compose capabilities more freely over time, the next step is to make `SKILL.md` first-class in execution and to reduce the amount of behavior that still lives in central runtime switches.

## Validation Note

I ran:

```bash
bun run test:unit:agent-loop
```

Result:

- 6 test files passed
- 1 test file failed
- failing test: `packages/extension/src/runtime/__tests__/agent-models.test.ts`
- failing case: `uses heuristic tab routing on transformers cold start while warming the pipeline`

This appears to be a pre-existing issue in the current branch, not something introduced by this analysis.
