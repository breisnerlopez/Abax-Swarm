#!/usr/bin/env bash
# Regenerate the 5 wizard screenshots used in the README.
#
# Headless reproducible flow:
#   tmux send-keys → captures the rendered Ink frame at each step
#   freeze         → renders ANSI to PNG with macOS-style window chrome
#
# Requirements:
#   - tmux  (apt: tmux)
#   - charmbracelet/freeze   (binary release: https://github.com/charmbracelet/freeze)
#
# Usage:  scripts/capture-screenshots.sh [output-dir]
# Default output-dir: docs/screenshots/

set -euo pipefail

OUT_DIR="${1:-docs/screenshots}"
WORK_DIR="$(mktemp -d)"
SAMPLE_DIR="$WORK_DIR/sample-project"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  tmux kill-session -t abax-cap 2>/dev/null || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: '$1' is required but not on PATH" >&2
    exit 1
  fi
}
require tmux
require freeze
require node

if [ ! -f "$REPO_ROOT/dist/cli/app.js" ]; then
  echo "Building project first…"
  (cd "$REPO_ROOT" && npm run build)
fi

mkdir -p "$OUT_DIR"
echo "Output: $OUT_DIR"
echo "Work:   $WORK_DIR"

run_freeze() {
  local input="$1" output="$2"
  freeze "$input" -o "$output" \
    --language ansi \
    --theme charm \
    --width 1500 \
    --margin 0 \
    --padding 30 \
    --window
}

# Start the wizard inside tmux with TERM=xterm-256color so colors render.
echo "[1/5] Starting wizard inside tmux…"
tmux new-session -d -s abax-cap -x 140 -y 50 \
  "TERM=xterm-256color node $REPO_ROOT/dist/cli/app.js init --dry-run"
sleep 2.5

# Step 1: target-dir
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/01-wizard-start.ansi"
run_freeze "$WORK_DIR/01-wizard-start.ansi" "$OUT_DIR/01-wizard-start.png"

# Type path → step 2 (platform)
tmux send-keys -t abax-cap "$SAMPLE_DIR" Enter
sleep 1.5
# Step 2 → 3 (provider)
tmux send-keys -t abax-cap Enter
sleep 1.2
# Step 3 → 4 (description)
tmux send-keys -t abax-cap Enter
sleep 1.2
# Step 4 → 5 (size)
tmux send-keys -t abax-cap Enter
sleep 1.2
# Step 5 → 5b (criteria), pick mediano
tmux send-keys -t abax-cap Down
sleep 0.4
tmux send-keys -t abax-cap Enter
sleep 1.2

echo "[2/5] Capturing criteria multi-select…"
# Mark some criteria
tmux send-keys -t abax-cap Down
sleep 0.3
tmux send-keys -t abax-cap Space
sleep 0.3
tmux send-keys -t abax-cap Down
sleep 0.3
tmux send-keys -t abax-cap Space
sleep 0.3
tmux send-keys -t abax-cap Down
sleep 0.3
tmux send-keys -t abax-cap Space
sleep 0.5
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/02-criteria-multiselect.ansi"
run_freeze "$WORK_DIR/02-criteria-multiselect.ansi" "$OUT_DIR/02-criteria-multiselect.png"

tmux send-keys -t abax-cap Enter
sleep 1.5
# Step 6 → 7 (stack), default first
tmux send-keys -t abax-cap Enter
sleep 1.2
# Step 7 → role-scope, lean
tmux send-keys -t abax-cap Down
sleep 0.3
tmux send-keys -t abax-cap Enter
sleep 2.5

echo "[3/5] Capturing role editor…"
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/03-team-editor.ansi"
run_freeze "$WORK_DIR/03-team-editor.ansi" "$OUT_DIR/03-team-editor.png"

# Continue → confirm
tmux send-keys -t abax-cap Enter
sleep 2.5

echo "[4/5] Capturing confirm step…"
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/05-confirmation.ansi"
run_freeze "$WORK_DIR/05-confirmation.ansi" "$OUT_DIR/05-confirmation.png"

# Confirm → done (dry-run)
tmux send-keys -t abax-cap Enter
sleep 3

echo "[5/5] Capturing dry-run done frame…"
tmux capture-pane -t abax-cap -p -e | grep -v "Pane is dead" > "$WORK_DIR/04-dryrun-summary.ansi"
run_freeze "$WORK_DIR/04-dryrun-summary.ansi" "$OUT_DIR/04-dryrun-summary.png"

echo ""
echo "Done. Captures written to $OUT_DIR/"
ls -la "$OUT_DIR/"*.png
