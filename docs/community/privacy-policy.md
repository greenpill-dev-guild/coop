---
title: Privacy Policy
slug: /privacy-policy
---

# Coop Privacy Policy

Date: March 20, 2026

This policy describes how the Coop browser extension and related Coop browser surfaces handle user
data.

## Summary

Coop is local-first. The extension stores and processes capture data on the device by default. Coop
does **not** run a hosted application API that stores your tab captures, screenshots, drafts, or
agent memory by default.

## What Coop Collects Locally

When you use the extension, Coop may store the following on your device:

- captured tab metadata such as titles, URLs, and timestamps
- page extracts and review drafts you create or edit
- screenshots or other receiver-capture payloads
- local agent memory and observation records
- local coop configuration, device pairing state, and UI preferences

Sensitive browsing-derived payloads are stored in encrypted form in the extension's local database.
Operational metadata needed for ordering, sync state, and UI rendering may remain in plaintext.

## What Leaves The Device

By default, Coop keeps captured browsing content local until you explicitly choose to share or
publish it.

Data may leave the device in the following cases:

- when you publish a draft or artifact into shared coop state
- when you pair with a receiver device and explicitly sync data to it
- when you use signaling infrastructure needed for peer sync
- when you opt into local AI features that need to download open model weights into the browser
  cache

Coop's signaling runtime is transport infrastructure. It is not intended to be a durable store for
your capture history.

## Third-Party Services

Coop may contact third-party infrastructure in limited cases:

- signaling servers that relay peer-sync traffic
- browser platform services such as passkeys / WebAuthn
- model or asset hosts that serve open model weights for local browser inference

The exact model-download endpoints used for a given release are recorded in the Chrome Web Store
reviewer notes for that release.

## Encryption And Retention

- Sensitive local browsing payloads are encrypted at rest with a locally generated secret.
- Orphaned raw blobs and stale encrypted browsing payloads are pruned automatically after 30 days.
- You can clear encrypted local capture history from the extension UI.

## Authentication And Identity

Coop uses passkey-first identity flows. Passkey material is handled through browser platform APIs.
If you enable additional live archive or onchain features, those modes may introduce extra local
credentials and external network calls consistent with the mode you selected.

## Your Choices

You can:

- keep using Coop locally without publishing captured material
- disable or avoid optional local AI features
- clear local capture history from the extension
- uninstall the extension and remove its local storage

## Contact

Questions about this policy can be directed through the Coop repository and project channels listed
at [GitHub](https://github.com/greenpill-dev-guild/coop).
