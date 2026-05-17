# Eval Results

Use this file for durable eval results. For Computer Use / browser evals, do
not record a passing score unless screenshot/error evidence exists.

## Baseline Queue

Run these first when establishing the next durable baseline. Keep each entry pending until evidence
exists; do not convert these rows into passes from docs, unit tests, or memory.

| Eval | Tool | Required evidence | Why it is first |
|------|------|-------------------|-----------------|
| `gemma-sandbox-health` | Computer Use or real headed Chromium | Popup, sidepanel, extension card, service-worker console, multimodal proof notes | Proves the local model sandbox and extension runtime are usable together. |
| `fresh-install-create-coop` | Computer Use or real headed Chromium | First-run popup, sidepanel create flow, extension card, console/service-worker state | Proves the first real user extension path after install. |
| `simple-advanced-gates` | Computer Use or real headed Chromium | Simple-mode surface, advanced toggle, gated controls, extension card | Proves the UI mode contract agents are expected to preserve. |
| `receiver-pwa-browser-eval` | Browser plus `test:e2e:receiver-pwa-eval` | Browser screenshot or Playwright trace plus command output | Proves the receiver PWA local preview and mobile fit without overusing Computer Use. |

## Results Table

| Date | Model | Agent | Eval | Browser | Commit | Score | Evidence | Extension Errors | Proof Limits | Follow-up |
|------|-------|-------|------|---------|--------|-------|----------|------------------|--------------|-----------|
| — | — | — | — | — | — | — | — | — | No evals run yet | — |

## Computer-Use Run Template

```markdown
### YYYY-MM-DD — <eval-slug>

- Model:
- Agent/tool:
- Browser/profile:
- Commit:
- Score:
- Popup screenshot:
- Sidepanel screenshot:
- Extension-card evidence:
- Summary JSON:
- Console/service-worker errors:
- What passed:
- What failed:
- Proof limits:
- Follow-up issue/commit:
```
