#!/bin/bash
# Check that agent teams prerequisites are met.
# Used by /teams command to verify readiness before spawning.
set -uo pipefail

ERRORS=0

# Check agents exist
for agent in oracle cracked-coder code-reviewer migration triage; do
  if [ ! -f ".claude/agents/$agent.md" ]; then
    echo "MISSING: .claude/agents/$agent.md" >&2
    ERRORS=$((ERRORS + 1))
  fi
done

# Check output contracts
if [ ! -f ".claude/standards/output-contracts.md" ]; then
  echo "MISSING: .claude/standards/output-contracts.md" >&2
  ERRORS=$((ERRORS + 1))
fi

# Check CLAUDE.md
if [ ! -f "CLAUDE.md" ]; then
  echo "MISSING: CLAUDE.md" >&2
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
  echo "Agent teams readiness check failed with $ERRORS errors." >&2
  exit 1
fi

echo "Agent teams readiness: OK"
exit 0
