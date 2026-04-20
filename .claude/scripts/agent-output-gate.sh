#!/bin/bash
# Gate for Stop/SubagentStop hooks on agent output.
# Validates that agent output follows the required section order from output-contracts.md.
# When invoked as a Stop/SubagentStop hook, it blocks once with a concrete reason so the agent can
# fix the output shape before finishing. On subsequent stop attempts it degrades to a warning to
# avoid infinite loops.
set -uo pipefail

STDIN_DETAILS="$(cat 2>/dev/null || true)"
EVENT_DETAILS="${STDIN_DETAILS:-${CLAUDE_HOOK_EVENT_DETAILS:-}}"
if [ -z "$EVENT_DETAILS" ]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

HOOK_EVENT_NAME="$(jq -r '.hook_event_name // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"
STOP_HOOK_ACTIVE="$(jq -r '.stop_hook_active // false' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'false')"
CONTENT="$(jq -r '.last_assistant_message // .tool_input.content // .tool_input.new_string // .tool_input.description // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"

if [ -z "$CONTENT" ]; then
  exit 0
fi

CONTENT_LOWER="$(printf '%s' "$CONTENT" | tr '[:upper:]' '[:lower:]')"

detect_output_type() {
  local text="$1"
  if printf '%s' "$text" | grep -q '### severity mapping' && printf '%s' "$text" | grep -q '### recommendation'; then
    echo "review"
  elif printf '%s' "$text" | grep -q '### classification' && printf '%s' "$text" | grep -Eq 'p[0-4]'; then
    echo "triage"
  elif printf '%s' "$text" | grep -q '### blast radius' && printf '%s' "$text" | grep -q '### execution order'; then
    echo "migration"
  elif printf '%s' "$text" | grep -q '### executive summary' && printf '%s' "$text" | grep -q '### confidence assessment'; then
    echo "oracle"
  else
    echo ""
  fi
}

OUTPUT_TYPE="$(detect_output_type "$CONTENT_LOWER")"

if [ -z "$OUTPUT_TYPE" ]; then
  exit 0
fi

MISSING_SECTIONS=""

case "$OUTPUT_TYPE" in
  review)
    for section in "summary" "human judgment callouts" "severity mapping" "must-fix" "should-fix" "nice-to-have" "verification" "recommendation"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="$MISSING_SECTIONS $section"
      fi
    done
    ;;
  triage)
    for section in "classification" "affected packages" "recommended route" "context for next agent"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="$MISSING_SECTIONS $section"
      fi
    done
    ;;
  migration)
    for section in "summary" "human judgment callouts" "blast radius" "execution order" "validation results" "risks / rollback" "completion checklist"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="$MISSING_SECTIONS $section"
      fi
    done
    ;;
  oracle)
    for section in "executive summary" "findings" "confidence assessment"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="$MISSING_SECTIONS $section"
      fi
    done
    ;;
esac

if [ -n "$MISSING_SECTIONS" ]; then
  REASON="$OUTPUT_TYPE output is missing sections:$MISSING_SECTIONS. See .claude/standards/output-contracts.md"
  if { [ "$HOOK_EVENT_NAME" = "Stop" ] || [ "$HOOK_EVENT_NAME" = "SubagentStop" ]; } && [ "$STOP_HOOK_ACTIVE" != "true" ]; then
    jq -Rn --arg reason "$REASON" '{decision:"block", reason:$reason}'
    exit 0
  fi

  echo "WARNING: $REASON" >&2
fi

exit 0
