---
title: Joining A Coop
slug: /joining-a-coop
---

# Joining A Coop

Joining should feel lightweight for the member and trustworthy for the group.

## How People Join

The current model is invite-based:

- a coop creator or trusted member generates an invite
- the invite carries the bootstrap information needed to join
- the new member enters a display name and seed contribution
- Coop verifies the invite, sets up membership, and connects the member to shared state

The goal is to keep the join flow legible even when the group is not relying on a central server.

## What To Expect As A New Member

You should expect three things when joining:

- a passkey-first identity flow instead of a wallet-extension-first onboarding
- a clear distinction between local capture and shared publish
- an initial view of the coop's purpose, members, and seed context so you are not joining blind

## Member And Trusted Member Are Different Roles

Coop distinguishes between regular members and trusted members.

Regular members can capture, review, and publish within the normal product flow. Trusted members are
the people the group trusts with more sensitive or bounded operations, such as operator and approval
work.

That split is part of the product's trust design. It keeps the common path simple without pretending
every action carries the same risk.

In the current extension:

- regular review work lives in the popup and `Chickens`
- shared coop history and archive views live in `Coops`
- trusted-member controls live in `Nest`
- if the coop uses Green Goods, the `Roost` tab is where a member sees Green Goods access and can
  submit work once their account and garden link are ready

Trusted operators, not ordinary members, handle Green Goods approvals, assessments, admin sync, and
Hypercert or Karma GAP packaging.

## Pairing The Receiver

After joining, a member can pair the receiver — the companion app for mobile and secondary-device
capture — so captures flow back into the coop's private intake path. That is useful when the
important context starts as:

- a voice memo after a meeting
- a photo of a whiteboard or field visit
- a file or link captured away from the main browser workspace

## Privacy During Join

Join is designed to avoid over-sharing:

- the invite is scoped to the coop and expires
- local capture stays local until a person publishes
- trust-sensitive actions still depend on role and policy, not just membership

Joining a coop should feel like entering a shared workspace, not surrendering control over all of
your private context.

## Where To Go Next

- Read [Sharing Knowledge](/sharing-knowledge) to understand what becomes shared coop memory.
- Read [Privacy & Security](/privacy-security) for the local-first boundary and sync model.
- Use the [Glossary](/glossary) when product terms like `Chickens`, `Coops`, `Roost`, or `Nest`
  are unfamiliar.
