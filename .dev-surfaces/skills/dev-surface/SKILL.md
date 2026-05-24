---
name: dev-surface
description: Use when working in Coop and needing to start, reuse, open, inspect, validate, or clean up this repo's local development surfaces through the shared dev-surfaces workbench.
---

# Coop Dev Surface

Use the global workbench CLI instead of starting duplicate servers manually:

```sh
dev-surfaces status
dev-surfaces up coop
dev-surfaces open coop
dev-surfaces logs coop:<surface>
dev-surfaces down coop
```

Stable fallback path: `/Users/afo/Code/dev-surfaces/bin/dev-surfaces.js`.

## Surfaces

- `app`: app / receiver PWA on `3101`
- `docs`: docs on `3102`
- `api`: API / signaling on `3103`
- `extension`: extension dev server, if bound on `3104`

## Validation Notes

- Default real-browser proof should use Brave or another Chromium-family browser on this machine.
- Keep receiver PWA and signaling URLs aligned when launching the extension surface.
- `app` depends on `api`, and `extension` depends on both, so the workbench brings signaling up before UI review surfaces that need it.
- After changing local port docs or dev scripts, run `dev-surfaces doctor`.

Never kill unknown port occupants. If a port is busy and not owned by dev-surfaces, report the PID/command and ask for direction.
