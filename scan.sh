#!/usr/bin/env bash
set -euo pipefail

BIN="${RUNNER_TEMP:-/tmp}/iv-bin"
mkdir -p "$BIN"

echo "::group::Installing grype"
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b "$BIN" >/dev/null
echo "::endgroup::"

JSON="${RUNNER_TEMP:-/tmp}/grype.json"
echo "Iron Vigil — scanning: $IV_TARGET"
"$BIN/grype" "$IV_TARGET" -o "sarif=$IV_SARIF" -o "json=$JSON" -q || true

# Optional: submit results to your Iron Vigil workspace (requires a CI API key).
if [ -n "${IV_TOKEN:-}" ] && [ -f "$JSON" ]; then
  echo "Submitting results to $IV_API …"
  curl -sS -X POST "$IV_API/api/v1/ci/scans" \
    -H "Authorization: Bearer $IV_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "@$JSON" >/dev/null 2>&1 \
    && echo "Submitted." \
    || echo "Submission skipped (CI API not reachable)."
fi

# Summary + severity gate (exits non-zero if the threshold is breached).
node "$IV_ACTION_PATH/summarize.js" "$JSON"
