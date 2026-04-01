---
title: Chrome Web Store Checklist
slug: /reference/chrome-web-store-checklist
---

# Chrome Web Store Submission Checklist

Date: March 30, 2026

This is the Chrome Web Store subset of the
[Production Release Checklist](/reference/production-release-checklist).

## Build And Audit

1. Set `VITE_COOP_RECEIVER_APP_URL` to the exact production HTTPS receiver origin for the release candidate.
2. Clear the staged launch bar first:
   `bun format && bun lint`, `bun run test`, `bun run test:coverage`, `bun run build`,
   `bun run validate:store-readiness`, `bun run validate:production-readiness`.
3. Only if the candidate enables live Safe, session-key, or archive rails and the live env
   contract is complete, run `bun run validate:production-live-readiness`.
4. Confirm the extension zip is created from `packages/extension/dist/chrome-mv3` with files at the archive root.

## Manual Verification

1. Load the unpacked release build in Chrome.
2. Verify popup roundup, popup manual-gate copy, file review/save, audio retry, and post-failure recovery.
3. Manually verify successful popup `Capture Tab` and `Screenshot` saves with a real click in Chrome. This remains outside reliable automation because popup `activeTab` is not granted the same way when the popup is opened programmatically.
4. Verify the sidepanel create/join, publish, board/archive, and receiver pairing flows still work.
5. Verify scheduled capture works for `30-min` and `60-min`.
6. Verify the built extension surface does not expose remote knowledge-skill import.
7. Use DevTools on first local-AI initialization and record the actual model-download endpoints.

As of March 28, 2026, the manual popup `Capture Tab` and `Screenshot` success check remains the
last staged-launch blocker after the automated bar passes.

## Listing And Policy Artifacts

1. Publish the public privacy policy at `/privacy-policy`.
2. Copy the current reviewer notes from `/reference/chrome-web-store-reviewer-notes`.
3. Make sure the listing description explains that Coop is local-first and publish is explicit.
4. Answer privacy prompts precisely: Coop stores user data locally on-device by default.

## Release Assertions

1. Confirm executable runtime assets are packaged with the extension and no remote `.js`, `.mjs`, or `.wasm` URLs appear in the built output.
2. Confirm host permissions stay on the exact receiver-origin allowlist.
3. Confirm hidden junk files such as `.DS_Store` are absent from `packages/extension/dist/chrome-mv3`.
4. Confirm built bundles still avoid `eval` and `new Function`.
5. Confirm sensitive local browsing payloads can be cleared from the UI.
6. Confirm release notes mention that remote knowledge-skill import is quarantined from the shipped build.
7. Confirm no embedded private key or trusted-node signing material is present in a public user release.
