# Coop Org-OS Integration

This package adapts organizational-os standards for Coop-specific onboarding and operations.

## Upstream Relationship

- Standards source: `03 Libraries/organizational-os/packages/framework`
- Deployable pattern source: `03 Libraries/organizational-os/packages/template`
- Coop keeps local package-level adaptations under `packages/org-os`

## Template Pattern Mapping

Each Coop setup should map to the organizational-os template operating model:

- `SOUL.md`: mission, values, voice
- `IDENTITY.md`: org metadata and network identity
- `MEMORY.md`: long-term decision and context memory
- `HEARTBEAT.md`: active execution status
- `TOOLS.md`: runtime-specific configuration

These are part of the template-based session model defined in:

- `03 Libraries/organizational-os/packages/template/AGENTS.md`

## Setup Flow

`scripts/setup-org-os.mjs` is the Coop bootstrap entrypoint. It should evolve toward:

1. Collect Coop identity and context inputs.
2. Seed onboarding and operating files for the Coop workspace.
3. Align generated output with template conventions and schema needs.

## Federation Linkage

`schemas/federation.yaml` captures Coop federation integration and should remain aligned with:

- hub integration expectations from `regen-coordination-os`
- skill names and capabilities exposed by Coop
- upstream schema conventions from organizational-os framework
