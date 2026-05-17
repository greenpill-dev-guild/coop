---
title: Storacha
slug: /builder/integrations/storacha
---

# Storacha

Storacha is Coop's upload and delegation path for archive actions.

## Why It Is Separate From Filecoin

In Coop's docs model:

- Storacha is the operational upload and delegation layer
- Filecoin is the live durability and provenance layer when that mode is configured and proved

Keeping those roles distinct makes the archive stack easier to reason about.

## Builder Concerns

- live mode depends on the right issuer and delegation environment values
- mock mode needs to stay deterministic so demos and tests remain practical
- archive setup flows should stay clear enough for trusted operators to diagnose without reading
  code first

## Reference Inputs

The runbook and install docs are the best sources for how archive configuration shows up in local and
production workflows.
