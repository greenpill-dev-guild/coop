# Agent Evaluation Framework

Structured test cases for verifying agent quality. Run evals after modifying agent definitions or skills.

## Structure

```
.claude/evals/
├── README.md           # This file
├── results.md          # Historical results table
├── triage/             # Triage agent evals
├── code-reviewer/      # Code reviewer evals
├── oracle/             # Oracle agent evals
└── extension-flows/    # Computer-use evals for real extension user flows
```

## Running Evals

Evals are run manually by spawning the agent with a test scenario and comparing output against expected results. Computer-use evals must include browser evidence, not only a narrative answer.

1. Pick a test case from the agent's eval directory
2. Spawn the agent with the scenario prompt
3. Compare output against the expected output and scoring rubric
4. Record results in `results.md`

## Scoring

- **triage**: Classification accuracy (correct severity, type, package routing)
- **code-reviewer**: Finding precision (true positives vs false positives, correct severity levels)
- **oracle**: Research quality (sources cited, synthesis depth, actionability of conclusions)
- **extension-flows**: Real-browser task completion, screenshot/error evidence, and proof-limit honesty

## Maturity

| Agent | Test Cases | Status |
|-------|-----------|--------|
| triage | 3 | ready |
| code-reviewer | 2 | ready |
| oracle | 2 | ready |
| extension-flows | 5 | ready |

## When to Run

- After modifying `.claude/agents/*.md`
- After modifying `.claude/skills/*/SKILL.md` for skills referenced by agents
- After changing extension popup, sidepanel, capture, review, Gemma sandbox, or simple/advanced gates
- Before upgrading model versions (compare scores across models)
- Quarterly regression check
