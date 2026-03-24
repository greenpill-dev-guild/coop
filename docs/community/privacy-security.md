---
title: Privacy & Security
slug: /privacy-security
---

# Privacy & Security

Coop's privacy and security story starts from a product boundary that users can understand: your
device can collect and structure private context locally, but shared coop state begins only when you
publish.

For the formal Chrome Web Store-facing disclosure, see the [Coop Privacy Policy](/privacy-policy).

## Local-First By Default

The current architecture keeps a lot of work on the device:

- raw captures
- local drafts and review material
- receiver intake before conversion
- browser-side AI analysis and observability logs

That gives members room to collect signal without assuming that every draft belongs in a shared
system immediately.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
flowchart TD
    Capture["Context captured"] --> Local["Stays on device\n(drafts, AI analysis,\nreceiver intake)"]
    Local --> Decision{"Member\npublishes?"}
    Decision -->|No| Private["Remains local\nNever leaves device"]
    Decision -->|Yes| Shared["Enters shared\ncoop state"]
    Shared --> Sync["Syncs to peers\nvia P2P"]
    Shared --> ArchiveQ{"Archive\nrequested?"}
    ArchiveQ -->|No| PeerOnly["Lives in\npeer network only"]
    ArchiveQ -->|Yes| Durable["Archived to Filecoin\nwith receipt"]
```

## Passkey-First Identity

Coop is built around passkey identity rather than a wallet-extension-first onboarding. That keeps
join and setup flows closer to familiar web behavior while still leaving room for stronger onchain
account structure behind the scenes.

## Clear Trust Boundaries

Not every action is equally sensitive. Coop distinguishes between:

- member actions such as capture, review, and publish
- trusted-member or operator actions such as bounded execution, archive handling, or policy work

This is why the product includes approval rules, permits, and time-bounded capabilities. The goal is
to keep more powerful actions explicit and reviewable.

## Anonymous And Private Paths

The repo also includes privacy-preserving extensions for groups that need them:

- anonymous membership proofs for group participation
- stealth-address support for more private receiving onchain

These are important capabilities, but they sit on top of the simpler product promise rather than
replacing it: know what is local, know what is shared, and know who can do what.

## Security Posture

Coop's security posture is shaped around a few practical ideas:

- validate inputs and action payloads strictly
- keep privileged execution bounded by policy
- protect against replay and expired authorizations
- avoid swallowing failures so the group can actually see when something went wrong

## Known Limits

No current system eliminates all risk. Coop still depends on good role hygiene, sound passkey
practices, and careful treatment of live archive or onchain credentials when those modes are enabled.

The important part is that the system's trust boundaries are meant to stay visible instead of being
hidden inside a black box.
