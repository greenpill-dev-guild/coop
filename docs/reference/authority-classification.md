# Authority Classification

This document defines the four authority classes in the Coop on-chain architecture.
Each authority class has distinct responsibilities and should not be collapsed into another.

## Authority Classes

### Safe Owner (`safe-owner`)

**What it is:** A signer on the Coop Safe smart account.

**Who holds it:** A small set of trusted stewards (members with role `creator` or `trusted`).

**What it controls:**
- Treasury and shared fund movements
- Protocol-level admin actions (garden ownership, GAP admin sync)
- Work approval and assessment attestations (proposal-first execution)
- Safe owner management (add/remove/swap owner, change threshold)

**What it is NOT:**
- Not every coop member should be a Safe owner
- Not the same as being a "member" or "gardener"

### Session Executor (`session-executor`)

**What it is:** A bounded, time-limited, replay-protected execution capability on the Coop Safe.

**Who holds it:** The agent harness or trusted-node runtime, authorized by a Safe owner.

**What it controls:**
- Garden creation (bootstrap)
- Garden profile sync
- Garden domain management
- Garden pool creation

**Constraints:**
- Action allowlist (only specific action classes)
- Target contract allowlist (per-action)
- Max uses and expiry
- Encrypted ephemeral signer material

### Member Account (`member-account`)

**What it is:** A per-user smart account backed by the member's passkey.

**Who holds it:** Each individual coop member who needs on-chain agency.

**What it controls:**
- Gardener lifecycle actions (add/remove self)
- Work evidence submission
- Impact report submission
- Receiving individual allocations or funds

**Why it's separate from Safe ownership:**
- Members need on-chain identity without treasury control
- Gardeners, assessors, and contributors act individually
- The Coop Safe remains the shared authority layer

### Semaphore Identity (`semaphore-identity`)

**What it is:** A zero-knowledge privacy layer for anonymous membership proofs.

**What it controls:**
- Anonymous endorsements
- Private attestations
- Privacy-preserving member gating
- Anonymous publishing

**What it is NOT:**
- Not a signer system
- Not a Safe owner abstraction
- Not for treasury control
- Not for user-operation signing or signer recovery

## Action to Authority Mapping

| Action Class | Authority | Notes |
|---|---|---|
| `safe-deployment` | Safe Owner | Initial Safe creation |
| `safe-add-owner` | Safe Owner | Add steward to Safe |
| `safe-remove-owner` | Safe Owner | Remove steward from Safe |
| `safe-swap-owner` | Safe Owner | Replace one steward with another |
| `safe-change-threshold` | Safe Owner | Adjust approval threshold |
| `green-goods-create-garden` | Session Executor | Bounded automation |
| `green-goods-sync-garden-profile` | Session Executor | Bounded automation |
| `green-goods-set-garden-domains` | Session Executor | Bounded automation |
| `green-goods-create-garden-pools` | Session Executor | Bounded automation |
| `green-goods-submit-work-approval` | Safe Owner | Proposal-first execution |
| `green-goods-create-assessment` | Safe Owner | Proposal-first execution |
| `green-goods-sync-gap-admins` | Safe Owner | Auto-detectable, owner execution |
| `green-goods-add-gardener` | Member Account | Individual member action |
| `green-goods-remove-gardener` | Member Account | Individual member action |
| `green-goods-submit-work-submission` | Member Account | Individual member action |
| `green-goods-submit-impact-report` | Member Account | Individual member action |

## Design Principles

1. **Shared authority** lives on the Coop Safe
2. **Personal authority** lives on a member account
3. **Privacy** lives in Semaphore
4. Do not collapse these into one abstraction
5. Do not use Semaphore for signer management or treasury control
