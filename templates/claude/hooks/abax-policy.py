#!/usr/bin/env python3
"""
Abax policy hook for Claude Code.

Mirrors the runtime enforcement that .opencode/plugins/abax-policy.ts
provides for opencode. Same merged policies file, different runtime.

Configured in .claude/settings.json under the `hooks` block:

  "hooks": {
    "PreToolUse":  [{ "matcher": "Task|Bash|Write|Edit",
                      "hooks": [{ "type": "command",
                                  "command": ".claude/hooks/abax-policy.py" }] }],
    "PostToolUse": [{ "matcher": "Task",
                      "hooks": [{ "type": "command",
                                  "command": ".claude/hooks/abax-policy.py" }] }]
  }

Three concerns, dispatched by hook_event_name + tool_name:

  PreToolUse  + Task                  → atomicity check
  PreToolUse  + Bash/Write/Edit/Task  → secret redaction
  PostToolUse + Task                  → runaway notice (never blocks)

Reads policies from .claude/policies/abax-policies.json (a verbatim copy
of the same file the opencode plugin reads — generator emits it to both
locations when the project targets claude).

Behaviour on missing/malformed policies file: fail-open (no-op). A
broken policy file should not block work.

Hook output protocol (Claude Code):
  - Exit 0 with no stdout = allow
  - Exit 0 with JSON stdout = structured response (decision, reason)
  - Exit 2 with stderr = block (Claude shows the stderr message)
  - Other exit codes = non-blocking error

We use exit 2 + stderr for block (clearest UX). For warn-level we
print to stderr but exit 0.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

# ---- Inputs --------------------------------------------------------------

try:
    payload = json.load(sys.stdin)
except json.JSONDecodeError:
    # Malformed payload — let Claude proceed; nothing for us to enforce.
    sys.exit(0)

event = payload.get("hook_event_name", "")
tool_name = (payload.get("tool_name") or "").lower()  # case-insensitive
tool_input = payload.get("tool_input") or {}
session_id = payload.get("session_id", "")
cwd = payload.get("cwd") or os.getcwd()

# ---- Load policies (fail-open) -------------------------------------------

policies_path = Path(cwd) / ".claude" / "policies" / "abax-policies.json"
policies: dict = {}
if policies_path.is_file():
    try:
        policies = json.loads(policies_path.read_text())
    except Exception as e:
        sys.stderr.write(f"[abax-policy] could not parse {policies_path}: {e}\n")

# ---- Helpers -------------------------------------------------------------

def _block(reason: str) -> None:
    """Block the tool call — exit 2 with stderr."""
    sys.stderr.write(reason + "\n")
    sys.exit(2)

def _warn(reason: str) -> None:
    """Emit a warning, do not block."""
    sys.stderr.write(reason + "\n")

def _scannable_text(name: str, args: dict) -> list:
    """Pick text fields from tool_input that should be scanned for secrets."""
    if not isinstance(args, dict):
        return []
    if name == "bash":
        return [str(args.get("command", ""))]
    if name == "write":
        return [str(args.get("content", ""))]
    if name == "edit":
        return [str(args.get("new_string", "")), str(args.get("old_string", ""))]
    if name == "task":
        return [str(args.get("prompt", "")), str(args.get("description", ""))]
    # Generic fallback for custom tools
    return [str(v) for v in list(args.values())[:8] if isinstance(v, str)]

# ---- Concern 1: Secret redaction (PreToolUse on bash/write/edit/task) ----

if event == "PreToolUse":
    secret_patterns = (policies.get("secret_patterns") or {}).get("patterns") or []
    for text in _scannable_text(tool_name, tool_input):
        if not text:
            continue
        for p in secret_patterns:
            try:
                m = re.search(p["regex"], text)
            except re.error:
                continue
            if not m:
                continue
            sample = m.group(0)
            preview = f"{sample[:6]}…({len(sample)} chars)"
            sev = p.get("severity", "block")
            msg = (
                f"[abax-policy/secret] matched pattern \"{p['id']}\" "
                f"({p.get('description', '')}). Preview: {preview}."
            )
            if sev == "block":
                _block(msg + " Rotate the secret and retry.")
            else:
                _warn(msg)

# ---- Concern 1.5: Phase-scope enforcement (PreToolUse on task) -----------

def _load_active_scope(policies: dict, cwd_path: Path) -> str:
    """Order: manifest pin > runtime state file > none."""
    if policies.get("active_iteration_scope"):
        return policies["active_iteration_scope"]
    state_path = cwd_path / ".claude" / "iteration-state.json"
    if state_path.is_file():
        try:
            st = json.loads(state_path.read_text())
            return st.get("active_scope") or ""
        except Exception:
            return ""
    return ""

def _detect_phase(args: dict, known: list) -> str:
    if not isinstance(args, dict):
        return ""
    p = args.get("phase")
    if isinstance(p, str) and p in known:
        return p
    haystack = (str(args.get("description") or "") + " " + str(args.get("prompt") or "")).lower()
    for pid in known:
        if pid.lower() in haystack:
            return pid
    return ""

def _detect_iteration_likely(cwd_path: Path) -> bool:
    if (cwd_path / "docs" / "bitacora.md").is_file():
        return True
    if (cwd_path / "docs" / "entregables" / "fase-9-cierre").is_dir():
        return True
    cl = cwd_path / "CHANGELOG.md"
    if cl.is_file():
        try:
            txt = cl.read_text()
            if any(line.startswith("## [") and line[4:5].isdigit() for line in txt.splitlines()):
                return True
        except Exception:
            return False
    return False

if event == "PreToolUse" and tool_name == "task" and policies.get("iteration_scopes"):
    active_id = _load_active_scope(policies, Path(cwd))
    known_phases_root = [p["id"] for p in policies.get("phases") or []]

    # ---- Skill invocation contract (M2.1) ----
    if not active_id:
        required = policies["iteration_scopes"].get("require_scope_for_phases", []) or []
        if required and _detect_iteration_likely(Path(cwd)):
            phase = _detect_phase(tool_input, known_phases_root)
            if phase and phase in required:
                _block(
                    f"[abax-policy/iteration-scope] blocked task delegation: project has "
                    f"iteration signals but no active_iteration_scope is set, and phase "
                    f"\"{phase}\" requires explicit scope confirmation.\n\n"
                    f"Action required: ASK THE USER which iteration type applies "
                    f"(major/minor/patch/hotfix) and then call set-iteration-scope with "
                    f"their answer. See the iteration-strategy skill for the question to ask."
                )

    if active_id:
        scope = next(
            (s for s in policies["iteration_scopes"].get("scopes", []) if s["id"] == active_id),
            None,
        )
        if scope:
            known_phases = [p["id"] for p in policies.get("phases") or []]
            phase = _detect_phase(tool_input, known_phases)
            if phase:
                if phase in scope.get("skip_phases", []):
                    _block(
                        f"[abax-policy/iteration-scope] blocked task delegation: phase "
                        f"\"{phase}\" is in skip_phases for active scope "
                        f"\"{scope['id']}\" ({scope['name']}).\n"
                        f"Reason: {scope.get('description','').splitlines()[0]}\n"
                        f"If genuinely needed, widen the scope via set-iteration-scope or "
                        f"edit iteration_scopes_override in project-manifest.yaml."
                    )
                allow = scope.get("minimal_phases", {}).get(phase)
                if allow and isinstance(allow, list) and allow:
                    delivery = str(tool_input.get("deliverable") or "")
                    if delivery and delivery not in allow:
                        _block(
                            f"[abax-policy/iteration-scope] blocked task delegation: "
                            f"deliverable \"{delivery}\" not in minimal_phases allowlist "
                            f"for phase \"{phase}\" under scope \"{scope['id']}\". "
                            f"Allowed: {', '.join(allow)}."
                        )

# ---- Concern 2: Atomicity (PreToolUse on task) ---------------------------

if event == "PreToolUse" and tool_name == "task":
    contracts = policies.get("task_contracts") or {}
    actions_def = contracts.get("atomic_actions") or []
    combos = contracts.get("forbidden_combinations") or []
    exemptions = contracts.get("exemptions") or []

    prompt_text = str(tool_input.get("prompt") or tool_input.get("description") or "")
    role = str(
        tool_input.get("subagent_type")
        or tool_input.get("agent")
        or ""
    )
    if prompt_text and combos:
        lower = prompt_text.lower()
        detected = set()
        for a in actions_def:
            for kw in a.get("keywords", []):
                if kw.lower() in lower:
                    detected.add(a["id"])
                    break

        exempt_ids = set()
        for e in exemptions:
            if e.get("role") == role:
                exempt_ids.update(e.get("allow_combinations", []))

        violations = []
        for combo in combos:
            if combo["id"] in exempt_ids:
                continue
            if all(a in detected for a in combo["actions"]):
                violations.append(combo)

        if violations:
            summary = "\n".join(
                f"  • {v['id']}: {v['reason'].splitlines()[0]}" for v in violations
            )
            _block(
                f"[abax-policy/atomicity] blocked task delegation to "
                f"\"{role or '?'}\": forbidden combination(s) detected.\n"
                f"Detected actions: {', '.join(sorted(detected))}\n"
                f"Violations:\n{summary}\n"
                f"Split this Task into smaller atomic Tasks (one responsibility each)."
            )

# ---- Concern 3: Runaway notice (PostToolUse on task) ---------------------

# Track sub-session start times in /tmp keyed by tool_use_id. The hook
# script is short-lived (one process per call), so we persist via a file.
_RUNAWAY_DIR = Path("/tmp") / f"abax-runaway-{os.getuid()}"

if event == "PreToolUse" and tool_name == "task":
    _RUNAWAY_DIR.mkdir(exist_ok=True)
    use_id = payload.get("tool_use_id") or ""
    if use_id:
        (_RUNAWAY_DIR / use_id).write_text(str(time.time()))

if event == "PostToolUse" and tool_name == "task":
    use_id = payload.get("tool_use_id") or ""
    started = None
    if use_id:
        marker = _RUNAWAY_DIR / use_id
        if marker.is_file():
            try:
                started = float(marker.read_text())
            except Exception:
                started = None
            try:
                marker.unlink()
            except Exception:
                pass

    duration_min = (time.time() - started) / 60 if started else None

    # Output size as proxy for parts/tokens. Claude post-hook payload
    # carries `tool_response` with the result text.
    tool_response = payload.get("tool_response")
    if isinstance(tool_response, dict):
        # Some versions wrap it
        text = json.dumps(tool_response)
    else:
        text = str(tool_response or "")
    output_chars = len(text)
    PARTS_PROXY_FACTOR = 250
    parts_approx = output_chars // PARTS_PROXY_FACTOR

    role = str(
        tool_input.get("subagent_type")
        or tool_input.get("agent")
        or ""
    )

    limits_block = policies.get("runaway_limits") or {}
    role_categories = policies.get("role_categories") or {}
    cat = role_categories.get(role)
    by_role = (limits_block.get("by_role") or {}).get(role) or {}
    by_cat = (limits_block.get("by_category") or {}).get(cat or "") or {}
    default = limits_block.get("default") or {}

    def _resolve(field):
        return by_role.get(field) or by_cat.get(field) or default.get(field)

    parts_max = _resolve("parts_max")
    duration_max = _resolve("duration_min_max")

    breaches = []
    if parts_max and parts_approx > parts_max:
        breaches.append(f"parts≈{parts_approx} > {parts_max}")
    if duration_max and duration_min and duration_min > duration_max:
        breaches.append(f"duration={duration_min:.1f}min > {duration_max}")
    if breaches:
        _warn(
            f"[abax-policy/runaway] notice: task to \"{role or '?'}\" "
            f"exceeded limit(s): {'; '.join(breaches)}."
        )

# Default: allow
sys.exit(0)
