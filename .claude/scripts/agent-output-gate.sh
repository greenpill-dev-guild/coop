#!/bin/bash
# Gate for PostToolUse hooks on agent output (SendMessage).
# Validates that agent output follows the required section order from output-contracts.md.
# Exit 0 = allow. Exit 2 = block with feedback.
#
# This is advisory validation — warns about missing sections but does not block.
set -uo pipefail

EVENT_DETAILS="${CLAUDE_HOOK_EVENT_DETAILS:-}"
if [ -z "$EVENT_DETAILS" ]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

CONTENT="$(jq -r '.tool_input.content // .tool_input.new_string // .tool_input.description // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"

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
    for section in "summary" "severity mapping" "must-fix" "verification" "recommendation"; do
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
    for section in "summary" "blast radius" "execution order" "validation results"; do
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
  echo "WARNING: $OUTPUT_TYPE output is missing sections:$MISSING_SECTIONS. See .claude/standards/output-contracts.md" >&2
fi

exit 0
