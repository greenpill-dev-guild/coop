---
title: Chrome Web Store Checklist
slug: /reference/chrome-web-store-checklist
---

# Chrome Web Store Submission Checklist

Date: March 20, 2026

## Build And Audit

1. Set `VITE_COOP_RECEIVER_APP_URL` to the exact production HTTPS receiver origin for the release candidate.
2. Run `bun run validate:store-readiness`.
3. Run `bun run validate:production-readiness` for the full release candidate.
4. Confirm the extension zip is created from `packages/extension/.output/chrome-mv3` with files at the archive root.

## Manual Verification

1. Load the unpacked release build in Chrome.
2. Verify the popup, sidepanel, manual tab capture, and screenshot capture work.
3. Verify scheduled capture works for `30-min` and `60-min`.
4. Verify receiver pairing and private intake sync still work.
5. Verify the built extension surface does not expose remote knowledge-skill import.
6. Use DevTools on first local-AI initialization and record the actual model-download endpoints.

## Listing And Policy Artifacts

1. Publish the public privacy policy at `/privacy-policy`.
2. Copy the current reviewer notes from `/reference/chrome-web-store-reviewer-notes`.
3. Make sure the listing description explains that Coop is local-first and publish is explicit.
4. Answer privacy prompts precisely: Coop stores user data locally on-device by default.

## Release Assertions

1. Confirm executable runtime assets are packaged with the extension and no remote `.js`, `.mjs`, or `.wasm` URLs appear in the built output.
2. Confirm host permissions stay on the exact receiver origin allowlist.
3. Confirm hidden junk files such as `.DS_Store` are absent from `packages/extension/.output/chrome-mv3`.
4. Confirm sensitive local browsing payloads can be cleared from the UI.
5. Confirm the release notes mention that remote knowledge-skill import is quarantined from the shipped build.
