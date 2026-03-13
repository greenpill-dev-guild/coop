---
name: architecture
user-invocable: false
description: Architecture patterns (Clean, Hexagonal, DDD), entropy reduction, and module boundary design. Use when restructuring modules, reducing codebase complexity, making cross-cutting architectural decisions, or the user asks about system design.
version: "1.0.0"
status: active
packages: ["shared", "app", "extension"]
dependencies: []
last_updated: "2026-03-12"
last_verified: "2026-03-12"
---

# Architecture Skill

System design patterns and entropy reduction philosophy for maintainable codebases.

---

## Activation

When invoked:
- Identify the smallest end-state codebase that solves the problem.
- Look for deletion opportunities before adding new abstractions.
- Validate against Coop core rules in `CLAUDE.md`.

## Part 1: Reducing Entropy

### The Goal

**Less total code in the final codebase** - not less code to write right now.

- Writing 50 lines that delete 200 lines = net win
- Keeping 14 functions to avoid writing 2 = net loss
- "No churn" is not a goal. Less code is the goal.

**Measure the end state, not the effort.**

### Three Questions

#### 1. What's the smallest codebase that solves this?

Not "what's the smallest change" - what's the smallest *result*.

- Could this be 2 functions instead of 14?
- Could this be 0 functions (delete the feature)?
- What would we delete if we did this?

#### 2. Does the proposed change result in less total code?

```
Before: X lines
After: Y lines

If Y > X -> Question the change
If Y < X -> Good direction
```

#### 3. What can we delete?

Every change is an opportunity to delete:
- What does this make obsolete?
- What was only needed because of what we're replacing?
- What's the maximum we could remove?

### Red Flags

| Red Flag | Reality |
|----------|---------|
| "Keep what exists" | Status quo bias. The question is total code, not churn. |
| "This adds flexibility" | Flexibility for what? YAGNI. |
| "Better separation of concerns" | More files/functions = more code. Separation isn't free. |
| "Type safety" | Worth how many lines? Sometimes runtime checks win. |
| "Easier to understand" | 14 things are not easier than 2 things. |

### Prioritization

When trade-offs arise: **Maintainability > Speed > Brevity**

Protect the existing architecture over shipping fast.

---

## Part 2: The Cathedral Test

Before writing code, run this mental checklist. Hold the "cathedral" (system architecture) in mind while laying this "brick" (specific change).

### 1. What Cathedral Am I Building?

Identify the system-level design this change supports:

| Domain | Coop Cathedral | Key Pattern |
|--------|---------------|-------------|
| **Local data** | Dexie for structured persistence | `useLiveQuery` for reactive reads |
| **Sync** | Yjs CRDTs + y-webrtc | `Y.Doc` per coop, rooms per session |
| **State management** | Zustand with granular selectors | Never `(s) => s`, always specific fields |
| **Auth** | Passkey-first, Safe-based identity | `useAuth` from shared, never local |
| **Module location** | ALL shared logic in `@coop/shared` | Never define hooks in app/extension |
| **Onchain** | Safe + ERC-4337 via viem/permissionless | Mock/live mode via env var |

**Ask**: "Which cathedral does this change belong to?"

### 2. Does This Brick Fit?

Find the most similar existing file and verify alignment:

| Check | Example Reference |
|-------|-------------------|
| Naming conventions | `useCoopMembers` -> `use[Domain][Action]` |
| Error handling | Categorized errors, user-friendly messages |
| State updates | Dexie writes or Zustand actions |
| Sync handling | Yjs doc updates, room lifecycle |
| Import structure | `import { x } from '@coop/shared'` |

**Reference file**: [identify the closest existing implementation]

### 3. Hidden Global Costs?

Check architectural rules:

| Rule | Check | Fix |
|------|-------|-----|
| **Timer Cleanup** | Raw setTimeout/setInterval? | Use cleanup in useEffect |
| **Event Listeners** | Missing removeEventListener? | Use `{ once: true }` or cleanup |
| **Async Mount Guard** | Async in useEffect without guard? | Use isMounted pattern |
| **Zustand Selectors** | `(s) => s` pattern? | Never `(s) => s`, use granular selectors |
| **Dexie Reactivity** | Manual polling for DB changes? | Use `useLiveQuery` |
| **Chained useMemo** | useMemo depending on useMemo? | Combine into single |
| **Context Values** | Inline object in Provider value? | Wrap in useMemo |

**Additional checks**:
- [ ] Does this break local-first guarantee?
- [ ] Is this duplicating logic in `@coop/shared`?
- [ ] Does this work offline?

### 4. Explain Non-Obvious Violations

When you spot a **non-obvious** violation:
1. Explain the principle being violated
2. Then suggest the fix

*For obvious violations (missing cleanup, hardcoded addresses), the fix is self-explanatory.*

---

## Part 3: Design Patterns

### Clean Architecture (Uncle Bob)

**Layers (dependencies point inward):**

```
+---------------------------------------------+
|           Frameworks & Drivers              |  <- UI, Database, External
+---------------------------------------------+
|           Interface Adapters                |  <- Controllers, Gateways
+---------------------------------------------+
|              Use Cases                      |  <- Application Logic
+---------------------------------------------+
|              Entities                        |  <- Business Rules
+---------------------------------------------+
```

**Key Principles:**
- Dependencies point inward only
- Inner layers independent of outer layers
- Business logic framework-agnostic
- Testable without external infrastructure

### Hexagonal Architecture (Ports & Adapters)

```typescript
// Port (interface)
interface ArchiveGateway {
  upload(content: Uint8Array, meta: ArchiveMeta): Promise<ArchiveResult>;
}

// Adapter (implementation)
class StorachaAdapter implements ArchiveGateway {
  async upload(content: Uint8Array, meta: ArchiveMeta): Promise<ArchiveResult> {
    return storachaClient.upload(content, meta);
  }
}

// Domain uses port, not adapter
class PublishService {
  constructor(private archive: ArchiveGateway) {}

  async publishDraft(draft: Draft): Promise<void> {
    await this.archive.upload(draft.content, draft.meta);
  }
}
```

### Domain-Driven Design (DDD)

**Tactical Patterns:**

```typescript
// Value Object (immutable, validated)
class InviteCode {
  constructor(readonly code: string) {
    if (code.length < 6) throw new Error("Invite code too short");
  }
}

// Entity (identity-based)
class Coop {
  constructor(
    readonly safeAddress: Address,  // Identity
    private name: string,
    private members: Member[]
  ) {}

  addMember(member: Member): void {
    this.members.push(member);
  }
}

// Aggregate Root (consistency boundary)
class Draft {
  publish(author: Member): void {
    if (this.status !== DraftStatus.Ready) {
      throw new Error("Can only publish ready drafts");
    }
    this.status = DraftStatus.Published;
  }
}
```

---

## Part 4: Coop Application

### Current Architecture

| Pattern | Implementation |
|---------|----------------|
| **Ports** | `@coop/shared` interfaces |
| **Adapters** | Package-specific implementations |
| **Bounded Contexts** | `extension` (browser experience), `app` (receiver/landing) |
| **Persistence** | Dexie tables + Yjs documents |

### When Adding Features

1. **Define the domain entity** in `shared/src/types/`
2. **Create port interface** in `shared/src/modules/` or `shared/src/hooks/`
3. **Implement adapter** using existing infrastructure
4. **Keep business logic** in domain, not UI

### Directory Structure

**Current structure** (`packages/shared/src/`):

```
+-- flows/            # XState state machines
+-- hooks/            # React hooks
+-- modules/          # Business logic modules (auth, coop, storage, archive, onchain)
+-- providers/        # React context providers
+-- stores/           # Zustand state stores
+-- types/            # TypeScript type definitions
```

> **Note:** Domain entities are defined in `types/`. Imports should use `@coop/shared` barrel exports.

---

## Anti-Patterns

| Anti-Pattern | Problem |
|--------------|---------|
| **Anemic Domain** | Entities with only data, no behavior |
| **Framework Coupling** | Business logic knows about browser APIs |
| **Fat Controllers** | Business logic in React components |
| **Missing Abstractions** | Concrete dependencies everywhere |
| **Over-Engineering** | DDD for simple CRUD operations |

---

## Best Practices Summary

1. **Dependencies point inward** — UI depends on domain, never reverse
2. **Small interfaces** — Interface segregation
3. **Domain logic separate** — No framework code in entities
4. **Test without infrastructure** — Mock adapters, test domain
5. **Bounded contexts** — Clear boundaries between domains
6. **Ubiquitous language** — Same terms in code and conversation
7. **Bias toward deletion** — Measure the end state
8. **Rich domain models** — Behavior with data

## Related Skills

- `react` — Component composition and state management patterns
- `testing` — TDD workflow that drives architectural decisions
- `performance` — Bundle analysis and optimization that validate architecture
- `migration` — Cross-package migration when architecture evolves
