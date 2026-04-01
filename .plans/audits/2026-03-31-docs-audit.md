# Docs Audit Report — 2026-03-31

## Executive Summary
- **Scope**: `docs/` (Docusaurus site at docs.coop.town)
- **Focus**: Cleanup and polish — dead content, structural issues, dependency health
- **Critical**: 0 | **High**: 2 | **Medium**: 5 | **Low**: 4
- **Dead code**: 8 unused files (knip), 5 orphaned docs (sidebar), 1 stray `node_modules` (491 MB)
- **Type errors**: 2 (NavbarItemConfig import, missing @docusaurus/types)
- **Build**: Clean (0 broken link warnings, 1 unrelated webpack warning)
- **Mode**: Single-agent

---

## Previous Findings Status

_Tracked from: 2026-03-24 (codebase audit, docs subset)_

### Docs-relevant findings from prior audit
| ID | Finding | File | Status | Notes |
|----|---------|------|--------|-------|
| D1 (was knip) | `@docusaurus/theme-common` flagged as unused dep | `docs/package.json:20` | **STILL OPEN, 2 cycles** | knip cannot trace Docusaurus theme overrides. The dep IS used by `src/theme/Navbar/Content/index.tsx`. However, the import references a non-existent export (`NavbarItemConfig` should be `NavbarItem`). |
| D2 (was knip) | 8 docs component files flagged as unused | `docs/src/` | **STILL OPEN, 2 cycles** | knip cannot trace theme overrides and MDX component registration. 6 of 8 ARE used (theme overrides, MDX components, navbar content). 2 style modules are consumed by their sibling components. All 8 are false positives. |

---

## High Findings

### H1. `NavbarItemConfig` type does not exist in `@docusaurus/theme-common` [NEW]
- **File**: `docs/src/theme/Navbar/Content/index.tsx:2`
- **Issue**: The import `import type { NavbarItemConfig } from '@docusaurus/theme-common'` references a type that does not exist. The actual exported type is `NavbarItem`. TypeScript reports TS2305: "Module has no exported member 'NavbarItemConfig'."
- **Impact**: The custom navbar theme override compiles via webpack (which skips type checks), so the site builds fine. But `npx tsc --noEmit` fails, and the `NavbarItemConfig` type silently resolves to `any`, removing type safety from the navbar item rendering pipeline.
- **Recommendation**: Change the import to `import type { NavbarItem } from '@docusaurus/theme-common'` and update usages of `NavbarItemConfig` to `NavbarItem` (lines 2, 11, 15).

### H2. 10.8 MB of WAV audio files tracked in git [NEW]
- **File**: `docs/assets/audio/*.wav` (5 files, 10.8 MB total)
- **Issue**: Five WAV files (312K to 7.5M) are committed to git. These are source audio files for Coop sound effects (rooster call, cluck, ambience candidates). Binary assets this large inflate clone size permanently and belong in Git LFS or an external asset store.
- **Recommendation**: Move to Git LFS (`git lfs track "*.wav"`) or to an external asset CDN. The `mixkit-farm-animals-in-the-morning.wav` at 7.5 MB is the largest offender and is listed only as an "extra ambience candidate."

---

## Medium Findings

### M1. 491 MB stray `node_modules` in `docs/community/` [NEW]
- **File**: `docs/community/node_modules/` (775 packages, 491 MB)
- **Issue**: A `node_modules` directory exists inside the community docs folder with no corresponding `package.json`. Likely created by an accidental `bun install` or `npm install` in the wrong directory. It is gitignored so it does not affect the repo, but it wastes disk space and could confuse tooling.
- **Recommendation**: Delete with `rm -rf docs/community/node_modules/`.

### M2. 5 docs files not reachable from sidebar navigation [NEW]
- **Files**:
  - `reference/agentic-interface.md` — 106 lines, substantive AG-UI event channel architecture doc, no frontmatter
  - `reference/claude-code-vs-coop-harness.md` — 112 lines, Claude Code vs Coop comparison, no frontmatter
  - `reference/production-release-checklist.md` — 407 lines, comprehensive release checklist with frontmatter
  - `testing/ui-action-coverage.md` — 89 lines, UI action coverage map, no frontmatter
  - `builder/agentic-harness.md` — 13 lines, pointer page to `reference/agent-harness` (already linked via sidebar `type: 'link'` entry)
- **Issue**: These pages exist and have valid slugs, but are not included in `sidebars.ts`. They are accessible only via direct URL or internal links. The `production-release-checklist` is linked from `demo-and-deploy-runbook.md` and `testing-and-validation.md` but not in the sidebar. The `agentic-interface` is not linked from anywhere. The `ui-action-coverage` is linked from `testing-and-validation.md`.
- **Recommendation**:
  - Add `reference/production-release-checklist` to the Operations subcategory in the sidebar
  - Add `reference/agentic-interface` to the Architecture subcategory (or merge into `agent-harness`)
  - Add `reference/claude-code-vs-coop-harness` to the Research subcategory
  - Add `testing/ui-action-coverage` to the Operations subcategory (or merge into `testing-and-validation`)
  - The `builder/agentic-harness` pointer page is redundant since the sidebar already has a `type: 'link'` entry pointing to `/reference/agent-harness`. Consider removing it.

### M3. 3 unlisted dependencies used in config/source [NEW]
- **Files**: `docs/docusaurus.config.ts`, `docs/sidebars.ts`, `docs/src/css/coop-prism-theme.ts`
- **Issue**: knip detects 3 unlisted dependencies:
  - `@docusaurus/types` — used in `docusaurus.config.ts:2` for the `Config` type
  - `@docusaurus/plugin-content-docs` — used in `sidebars.ts:1` for the `SidebarsConfig` type
  - `prism-react-renderer` — used in `src/css/coop-prism-theme.ts:1`
- **Impact**: These resolve at build time because they're transitive deps of `@docusaurus/preset-classic`, but they should be explicitly listed as devDependencies for correctness.
- **Recommendation**: Add all three as devDependencies: `bun add -D @docusaurus/types @docusaurus/plugin-content-docs prism-react-renderer --cwd docs`

### M4. `onBrokenLinks: 'warn'` should be `'throw'` for production [NEW]
- **File**: `docs/docusaurus.config.ts:11`
- **Issue**: The Docusaurus config uses `onBrokenLinks: 'warn'`, which means broken links only produce build warnings (easy to miss) instead of failing the build. For a published docs site, broken links should fail the build.
- **Recommendation**: Change to `onBrokenLinks: 'throw'` after fixing any broken links. Currently the build produces zero link warnings, so this change is safe to make now.

### M5. 4 reference docs missing frontmatter [NEW]
- **Files**: `reference/agentic-interface.md`, `reference/authority-classification.md`, `reference/claude-code-vs-coop-harness.md`, `reference/skills-system-deep-dive-2026-03-20.md`
- **Issue**: These files lack YAML frontmatter (`---` block with title/slug). Docusaurus will auto-generate a slug from the file path, but explicit frontmatter ensures consistent slugs and titles in the sidebar and browser tab.
- **Impact**: Low functional impact since Docusaurus handles this gracefully, but inconsistent with all other docs which have frontmatter.
- **Recommendation**: Add frontmatter with `title` and `slug` fields matching the pattern used by other reference docs.

---

## Low Findings

### L1. 4 `.DS_Store` files in docs tree
- `docs/.DS_Store`, `docs/assets/.DS_Store`, `docs/static/.DS_Store`, `docs/build/.DS_Store`
- These are macOS metadata files. While likely gitignored, they should be cleaned up locally.

### L2. Duplicate branding images across `assets/branding/` and `static/branding/`
- 5 files exist in both locations. 4 are byte-identical; `coop-wordmark-flat.png` differs between the two.
- `static/branding/` is what Docusaurus serves; `assets/branding/` is only referenced in prose documentation about the brand. The `assets/` copies are not rendered anywhere.
- **Recommendation**: Keep `static/branding/` as the source of truth for served images. Document in the illustration brief that `assets/branding/` is the extended set (it has 20 files vs 5 in static). Investigate why `coop-wordmark-flat.png` differs.

### L3. `testing/ui-action-coverage.md` lacks frontmatter and is in a non-standard directory
- The `testing/` directory contains a single file. All other content lives in `community/`, `builder/`, or `reference/`. Consider moving to `reference/ui-action-coverage.md` for consistency.

### L4. `reference/extension-ui-redesign-plan.md` uses "WIP" markers without dates
- 4 instances of "WIP" at lines 137, 144, 147, 286. These are legitimate design-phase markers but have no associated completion targets or dates.

---

## Dead Code (knip results)

### Unused Files (8 — all false positives)
knip reports 8 docs files as unused. All are false positives because knip cannot trace:
- Docusaurus theme overrides (`DocRoot/Layout`, `MDXComponents`, `Navbar/Content`)
- MDX component imports (`WelcomeHero`, `CoopCard`, `AudienceTabs`)
- Supporting libraries (`docsAudience.ts`)
- The MDX welcome page (`welcome-to-coop.mdx`)

**Recommendation**: Add a `knip.config.ts` entry for the docs workspace to ignore theme overrides and MDX-registered components, or add `// knip:ignore` comments.

### Unused Dependencies (1)
| Package | Dependency | Status |
|---------|-----------|--------|
| docs | `@docusaurus/theme-common` | **False positive** — used by theme override `Navbar/Content/index.tsx` |

### Unlisted Dependencies (3)
| Package | Used In | Status |
|---------|---------|--------|
| `@docusaurus/types` | `docusaurus.config.ts` | Should be added as devDep |
| `@docusaurus/plugin-content-docs` | `sidebars.ts` | Should be added as devDep |
| `prism-react-renderer` | `coop-prism-theme.ts` | Should be added as devDep |

---

## Architectural Notes

| Pattern | Location | Notes |
|---------|----------|-------|
| Audience filtering (community/builder) | Sidebar CSS classes + `DocRoot/Layout` wrapper | Clean pattern; `docsAudience.ts` lib handles localStorage memory |
| Theme overrides | `src/theme/` (3 files) | Correct Docusaurus swizzling pattern |
| Custom components | `src/components/` (3 components) | Registered via `MDXComponents.ts` (`CoopCard`) and imported directly (`WelcomeHero`, `AudienceTabs`) |
| Redirect coverage | `docusaurus.config.ts` (18 redirects) | All redirect targets verified — 0 broken |
| Custom CSS | `src/css/custom.css` (482 lines) | Well-structured with design token bridge, dark mode, accessibility |
| Prism theme | `src/css/coop-prism-theme.ts` | Custom syntax highlighting matching brand palette |

---

## Trend (docs audits)

| Metric | 2026-03-24 (subset) | **2026-03-31** |
|--------|---------------------|----------------|
| Critical | 0 | **0** |
| High | 0 | **2** |
| Medium | 0 | **5** |
| Low | 0 | **4** |
| Broken links (build) | -- | **0** |
| Orphaned sidebar docs | -- | **5** |
| Type errors | -- | **2** |
| knip false positives | 8+1 | **8+1** (same) |
| Audio binary size (git) | -- | **10.8 MB** |

**Observations**: This is the first dedicated docs audit, so there is no prior trend data. The docs site builds cleanly with zero broken link warnings. The main structural issues are: (1) the `NavbarItemConfig` type error which silently degrades the navbar type safety, (2) large WAV files committed to git history, and (3) five substantive docs pages that are invisible in the sidebar. The CSS and component architecture is clean and follows Docusaurus conventions well.

---

## Recommendations (Priority Order)

1. **Fix `NavbarItemConfig` -> `NavbarItem` import** — Restores type safety in the custom navbar override. (High, H1)

2. **Move WAV files to Git LFS** — Reduces clone size by ~11 MB. Consider dropping the 7.5 MB ambience candidate. (High, H2)

3. **Delete `docs/community/node_modules/`** — Reclaims 491 MB of disk space. (Medium, M1)

4. **Add 5 orphaned docs to sidebar** — `production-release-checklist` is the most important; it's a 407-line comprehensive checklist linked from other docs but not navigable. (Medium, M2)

5. **Add 3 unlisted devDependencies** — `@docusaurus/types`, `@docusaurus/plugin-content-docs`, `prism-react-renderer`. (Medium, M3)

6. **Change `onBrokenLinks` to `'throw'`** — Safe to do now since build has zero link warnings. Prevents future regressions. (Medium, M4)

7. **Add frontmatter to 4 reference docs** — Consistency improvement. (Medium, M5)

8. **Clean up `.DS_Store` files** — Minor housekeeping. (Low, L1)
