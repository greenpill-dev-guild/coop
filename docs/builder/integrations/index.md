---
title: Integrations
slug: /builder/integrations
---

# Integrations

Coop is intentionally built from a small set of external systems that each serve a clear job. This
page is the map before the deeper integration pages.

## Identity And Execution

| Integration | Why It Exists In Coop |
| --- | --- |
| WebAuthN | Passkey-first identity without a wallet-extension-first UX |
| Gnosis Safe | Group smart account and bounded execution surface |
| Green Goods | Garden and governance-adjacent coordination actions |

## Local Intelligence And State

| Integration | Why It Exists In Coop |
| --- | --- |
| WebLLM | Browser-native synthesis and local model execution |
| Yjs | Shared CRDT state across peers |
| Dexie | Structured local persistence on top of IndexedDB |

## Durability And Archive

| Integration | Why It Exists In Coop |
| --- | --- |
| Storacha | Delegated upload and archive workflow |
| Filecoin | Durable storage and provenance story |

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
graph TB
    subgraph Identity["Identity & Execution"]
        WebAuthn[WebAuthn / Passkeys]
        Safe[Gnosis Safe]
        GG[Green Goods]
    end

    subgraph Intelligence["Local Intelligence"]
        WebLLM[WebLLM]
        Yjs[Yjs CRDT]
        Dexie[Dexie / IndexedDB]
    end

    subgraph Durability["Durability & Archive"]
        Storacha[Storacha]
        Filecoin[Filecoin]
    end

    WebAuthn -->|"passkey → identity"| Safe
    Safe -->|"bounded execution"| GG
    WebLLM -->|"AI analysis"| Dexie
    Yjs -->|"shared state"| Dexie
    Storacha -->|"upload"| Filecoin
```

## Design Principle

Each integration exists to support the local-first coordination loop. Coop is not trying to become a
generic showcase for standards. If a dependency does not strengthen capture, review, shared memory,
or bounded execution, it should not be in the stack by default.
