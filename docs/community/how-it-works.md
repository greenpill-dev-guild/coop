---
title: How It Works
slug: /how-it-works
---

# How It Works

Coop is built around one practical loop: gather context, make sense of it locally, review it with
humans, and then share only what should become part of a group's memory.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#5a7d10', 'primaryTextColor': '#4f2e1f', 'primaryBorderColor': '#6b4a36', 'lineColor': '#6b4a36', 'secondaryColor': '#fcf5ef', 'tertiaryColor': '#fff8f2'}}}%%
flowchart LR
    Capture["Capture\nTabs, audio, photos,\nfiles, links"] --> Refine["Refine\nLocal AI analysis\nin the browser"]
    Refine --> Review["Review\nHuman triage\nin the Roost"]
    Review --> Share["Share\nPublish to Feed,\nsync to peers,\narchive"]
    Share -.->|"new context"| Capture
```

## 1. Capture

Capture starts from the places communities already work:

- browser tabs — your Loose Chickens — rounded up from the extension
- audio, photos, files, and links captured from the receiver (the companion app)
- member notes and seed contributions added during coop setup or join flows

The point is not to create more input chores. It is to make useful fragments easier to catch before
they disappear.

## 2. Refine

After capture, Coop can run local analysis in the browser:

- extract the main idea from a page or file
- score whether something looks relevant to the coop's purpose
- cluster related findings
- draft summaries and suggested next steps

This happens before publish. It is meant to reduce noise, not to make irreversible decisions.

## 3. Review

Drafts land in the Roost, which is the review queue. This is where members decide:

- what is actually worth keeping
- what needs editing or re-framing
- which coop or coops a draft belongs to
- whether something should stay local, be shared, or be archived

Review is a product boundary, not a decorative step. Coop is opinionated that a group's memory
should pass through human judgment.

## 4. Share

When a member publishes a draft, it becomes shared coop state. That shared state can then:

- appear in the Coop Feed
- show up in the board view
- sync to peers over the local-first replication layer
- be archived with receipts when the group wants durable proof and provenance

## Where Each Surface Fits

The extension is the primary workspace. It is where people create coops, join them, review drafts,
and manage the Coop Feed. Within the extension, the popup handles quick actions like draft review,
feed browsing, coop creation and joining, and profile management, while the sidepanel handles deeper
editorial and admin work.

The app exists to make mobile and secondary-device capture practical. It is especially useful when a
piece of context starts as a voice memo, photo, or quick link rather than a browser tab.

## What Coop Does Not Do By Default

- It does not auto-publish captured material.
- It does not send raw captures to a cloud inference service as the default path.
- It does not require a wallet-extension-first setup just to participate.
- It does not assume every artifact belongs in long-term storage.

That restraint is part of the product model. Coop should help a group move from context to
coordination without making the trust boundary fuzzy.
