#!/usr/bin/env bash
# Regenerate the wizard screenshots used in the README.
#
# Headless reproducible flow:
#   tmux send-keys → captures the rendered Ink frame at each step
#   freeze         → renders ANSI to PNG with macOS-style window chrome
#
# Requirements:
#   - tmux  (apt: tmux)
#   - charmbracelet/freeze   (binary release: https://github.com/charmbracelet/freeze)
#   - node + a built dist/ (or run npm run build first)
#
# Usage:  scripts/capture-screenshots.sh [output-dir]
# Default output-dir: docs/screenshots/
#
# This script reflects the wizard flow as of v0.1.11:
#   1. target-dir         (path defaults to cwd, just press Enter)
#   2. project-mode       (NEW: pick "Implementar algo nuevo" to keep the cascade flow)
#   3. platform           (OpenCode by default)
#   4. model-strategy     (NEW: pick "Personalizado" to keep the model mix)
#   5. provider           (Anthropic by default)
#   6. description        (defaults to "Proyecto <basename>")
#   7. size               (Pequeño by default → triggers criteria step)
#   8. criteria           (multi-select; we pick a couple to populate)
#   9. stack              (first option)
#  10. role-scope         (lean)
#  11. role-edit          (skip with Enter)
#  12. confirm            (preview)
#
# Outputs (6 PNGs):
#   01-wizard-start.png         step 1 (target dir)
#   02-project-mode.png         step 2 (NEW — the three modes)
#   03-criteria-multiselect.png step 8 (criteria multi-select)
#   04-team-editor.png          step 11 (team review/edit)
#   05-confirmation.png         step 12 (preview with model mix)
#   06-dryrun-summary.png       final dry-run summary

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
echo "[1/6] Starting wizard inside tmux…"
tmux new-session -d -s abax-cap -x 140 -y 50 \
  "TERM=xterm-256color node $REPO_ROOT/dist/cli/app.js init --dry-run"
sleep 2.5

# === Step 1: target-dir ===
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/01-wizard-start.ansi"
run_freeze "$WORK_DIR/01-wizard-start.ansi" "$OUT_DIR/01-wizard-start.png"

# TextInput pre-fills with process.cwd() since v0.1.7, so we must clear it
# before writing the sample path. ink-text-input doesn't honor Ctrl-U; the only
# portable way is sending enough Backspaces to erase the longest plausible cwd.
# Send in chunks so ink has time to process each batch.
for _ in $(seq 1 5); do
  for _ in $(seq 1 30); do
    tmux send-keys -t abax-cap BSpace
  done
  sleep 0.4
done
sleep 1.0
tmux send-keys -t abax-cap "$SAMPLE_DIR"
sleep 0.8
tmux send-keys -t abax-cap Enter
sleep 2.5

# === Step 2: project-mode (NEW in v0.1.11) ===
echo "[2/6] Capturing project-mode step…"
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/02-project-mode.ansi"
run_freeze "$WORK_DIR/02-project-mode.ansi" "$OUT_DIR/02-project-mode.png"

# Pick the default "Implementar algo nuevo" → goes to platform
tmux send-keys -t abax-cap Enter
sleep 1.2

# === Steps 3..7: platform → model-strategy → provider → permissions → isolation → description → size ===
tmux send-keys -t abax-cap Enter   # platform: OpenCode (default)
sleep 1.2
tmux send-keys -t abax-cap Enter   # model-strategy: Personalizado (default)
sleep 1.2
tmux send-keys -t abax-cap Enter   # provider: Anthropic (default)
sleep 1.2
tmux send-keys -t abax-cap Enter   # permissions: Recomendado (default)
sleep 1.2
tmux send-keys -t abax-cap Enter   # isolation: Devcontainer (default)
sleep 1.2
tmux send-keys -t abax-cap Enter   # description: keep default
sleep 1.2
tmux send-keys -t abax-cap Enter   # size: Pequeño (default)
sleep 1.2

# === Step 8: criteria multi-select ===
echo "[3/6] Capturing criteria multi-select…"
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
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/03-criteria-multiselect.ansi"
run_freeze "$WORK_DIR/03-criteria-multiselect.ansi" "$OUT_DIR/03-criteria-multiselect.png"

tmux send-keys -t abax-cap Enter
sleep 1.5

# === Steps 9..10: stack → role-scope (lean) ===
tmux send-keys -t abax-cap Enter   # stack: first
sleep 1.2
tmux send-keys -t abax-cap Down
sleep 0.3
tmux send-keys -t abax-cap Enter   # role-scope: lean
sleep 2.5

# === Step 11: role-edit ===
echo "[4/6] Capturing role editor…"
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/04-team-editor.ansi"
run_freeze "$WORK_DIR/04-team-editor.ansi" "$OUT_DIR/04-team-editor.png"

tmux send-keys -t abax-cap Enter   # confirm role-edit
sleep 2.5

# === Step 12: confirm preview ===
echo "[5/6] Capturing confirm step…"
tmux capture-pane -t abax-cap -p -e > "$WORK_DIR/05-confirmation.ansi"
run_freeze "$WORK_DIR/05-confirmation.ansi" "$OUT_DIR/05-confirmation.png"

tmux send-keys -t abax-cap Enter   # generate (dry-run)
sleep 3

echo "[6/6] Capturing dry-run done frame…"
tmux capture-pane -t abax-cap -p -e | grep -v "Pane is dead" > "$WORK_DIR/06-dryrun-summary.ansi"
run_freeze "$WORK_DIR/06-dryrun-summary.ansi" "$OUT_DIR/06-dryrun-summary.png"

echo ""
echo "Done. Captures written to $OUT_DIR/"
ls -la "$OUT_DIR/"*.png
