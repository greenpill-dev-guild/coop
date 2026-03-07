# Plan 06 - Org-OS Integration

## Scope

Harden `packages/org-os` so Coop setup and schema alignment follow organizational-os standards while staying Coop-focused.

## Current State

- Coop-local schema and script scaffolds exist.
- Skills in this package are minimal stubs.
- Template pattern alignment is incomplete.

## Todos

1. Remove hardcoded path assumptions in schema generation scripts.
2. Align `federation.yaml` skill naming with coop skills taxonomy.
3. Upgrade org-os package skills to full specification quality.
4. Improve setup script with interactive bootstrap prompts.
5. Add explicit documentation for mapping Coop to organizational-os template architecture.

## Dependencies

- `07-skills-system.md` for unified skill metadata conventions.
- Organizational standards from `03 Libraries/organizational-os/packages/template`.

## Key Files

- `packages/org-os/scripts/generate-all-schemas.mjs`
- `packages/org-os/scripts/setup-org-os.mjs`
- `packages/org-os/schemas/federation.yaml`
- `packages/org-os/skills/meeting-processor/SKILL.md`
- `packages/org-os/skills/knowledge-curator/SKILL.md`
- `packages/org-os/README.md` (new)

## Dependencies to Install

- `@clack/prompts`
- `gray-matter`
- `js-yaml`

## Done Criteria

- Setup script supports Coop-specific onboarding values.
- Schema generation works on any machine path.
- Org-OS package docs clearly define upstream template linkage.
