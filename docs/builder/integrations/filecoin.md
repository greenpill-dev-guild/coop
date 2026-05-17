---
title: Filecoin
slug: /builder/integrations/filecoin
---

# Filecoin

Filecoin is Coop's optional live durability and provenance layer.

## Why Coop Uses It

Coop wants archive to mean more than "we made a backup." When live archive mode is enabled and
proved, Filecoin can give published artifacts and snapshots a stronger long-memory story with
receipts the group can inspect later.

## What Belongs Here

Filecoin is the right place to think about:

- durable archive outcomes
- provenance and receipt chains
- why a snapshot matters beyond the current browser session
- piece-level follow-up and deal visibility over time

## What Does Not Belong Here

Storacha handles the delegated upload and operational handoff. Filecoin is the live durability layer
beneath that when the operator has configured the live archive path.
