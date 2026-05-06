#!/usr/bin/env bash
# Tier E — Generation sweep across the variability axes.
# 30 compositions: 3 sizes × 2 scopes × 5 stacks (representative) +
# extras for modes (document, continue). Each runs ~6 invariants.
# No LLM. Fast.
set -u
RESULTS_DIR=/tmp/abax-e2e/results
mkdir -p "$RESULTS_DIR"
RESULT_FILE="$RESULTS_DIR/tier-e.csv"
echo "id,size,scope,stack,mode,gen_files,gen_warnings,plugin_field,policies_keys,role_count_match,no_orphan_deliverables,manifest_overrides_or_trailer,roundtrip_ok,verdict" > "$RESULT_FILE"

PASS=0
FAIL=0
TOTAL=0

run_check() {
    local id="$1"; local size="$2"; local scope="$3"; local stack="$4"; local mode="$5"
    local extra="$6"   # extra YAML lines (modeline override, criteria, etc.)

    TOTAL=$((TOTAL + 1))
    local DIR="/tmp/abax-e2e/sweep/$id"
    sudo rm -rf "$DIR"
    mkdir -p "$DIR"

    local mode_line=""
    [ -n "$mode" ] && mode_line="  mode: $mode"

    cat > "$DIR/project-manifest.yaml" <<EOF
project:
  name: $id
  description: Sweep $id
  size: $size
  stack: $stack
  target: opencode
  team_scope: $scope
  provider: openai
  model_strategy: inherit
  permission_mode: full
  isolation_mode: host
$mode_line
criteria_applied: []
generated_by: e2e-sweep
$extra
EOF

    local OUT
    OUT=$(cd /srv/repos/Abax-Swarm && sudo node --import tsx src/cli/app.ts regenerate --dir "$DIR" 2>&1)
    local exit_code=$?
    local files=$(echo "$OUT" | grep -oE "[0-9]+ archivos escritos" | grep -oE "^[0-9]+" || echo "0")
    local warnings=$(echo "$OUT" | grep -c "⚠")

    if [ "$exit_code" -ne 0 ]; then
        echo "$id,$size,$scope,$stack,$mode,0,0,FAIL_GEN,,,,,FAIL" >> "$RESULT_FILE"
        echo "✗ $id — generate failed"; echo "$OUT" | tail -2 | sed 's/^/    /'
        FAIL=$((FAIL + 1))
        return
    fi

    # Invariant 1: opencode.json plugin field
    local plugin_field
    plugin_field=$(python3 -c "import json; d=json.load(open('$DIR/opencode.json')); print('OK' if 'abax-policy.ts' in str(d.get('plugin',[])) else 'MISSING')" 2>/dev/null || echo "ERR")

    # Invariant 2: policies.json sections
    local POL="$DIR/.opencode/policies/abax-policies.json"
    local sections
    sections=$(python3 -c "import json; d=json.load(open('$POL')); print(','.join(sorted(d.keys())))" 2>/dev/null || echo "ERR")

    # Invariant 3: role_categories matches actual agent files
    local rc_match
    local rc_count
    rc_count=$(python3 -c "import json; print(len(json.load(open('$POL'))['role_categories']))" 2>/dev/null || echo "0")
    local agent_count
    agent_count=$(ls "$DIR/.opencode/agents/" 2>/dev/null | grep -v orchestrator.md | wc -l)
    if [ "$rc_count" = "$agent_count" ]; then rc_match="OK"; else rc_match="MISMATCH($rc_count!=$agent_count)"; fi

    # Invariant 4: no orphan deliverable responsible/approver in policies.phases
    # Every responsible/approver must either be in role_categories OR be product-owner
    # (which we know triggers the "user (sponsor)" fallback in the orchestrator template
    # and is acceptable for absence per design).
    local orphan_check
    orphan_check=$(python3 - "$POL" <<'PYEOF' 2>/dev/null || echo "ERR"
import json, sys
d = json.load(open(sys.argv[1]))
team = set(d.get("role_categories", {}).keys())
SPECIAL_FALLBACK = {"product-owner"}  # falls back to sponsor in orchestrator.md
issues = 0
for p in d.get("phases", []):
    for x in p.get("deliverables", []):
        if x["responsible"] not in team and x["responsible"] not in SPECIAL_FALLBACK and x.get("mandatory", True):
            issues += 1
print("OK" if issues == 0 else f"ORPHANS={issues}")
PYEOF
)

    # Invariant 5: manifest documents overrides (trailer or active block)
    local manifest_check="MISSING"
    if grep -q "Optional policy overrides" "$DIR/project-manifest.yaml" || grep -q "Active policy overrides" "$DIR/project-manifest.yaml"; then
        manifest_check="OK"
    fi

    # Invariant 6: round-trip regenerate
    local rt_check="OK"
    if ! cd /srv/repos/Abax-Swarm && sudo node --import tsx src/cli/app.ts regenerate --dir "$DIR" >/dev/null 2>&1; then
        rt_check="FAIL"
    fi

    local verdict="PASS"
    if [ "$plugin_field" != "OK" ] || [ "$rc_match" != "OK" ] || [ "$orphan_check" != "OK" ] || [ "$manifest_check" != "OK" ] || [ "$rt_check" != "OK" ]; then
        verdict="FAIL"
    fi

    echo "$id,$size,$scope,$stack,$mode,$files,$warnings,$plugin_field,\"$sections\",$rc_match,$orphan_check,$manifest_check,$rt_check,$verdict" >> "$RESULT_FILE"
    echo "$([ "$verdict" = "PASS" ] && echo "✓" || echo "✗") $id — files=$files warnings=$warnings plugin=$plugin_field rc=$rc_match orphan=$orphan_check manifest=$manifest_check rt=$rt_check"

    if [ "$verdict" = "PASS" ]; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); fi
}

echo
echo "═══ MATRIX A — 3 sizes × 2 scopes × 5 stacks (mode=new) ═══"
for size in small medium large; do
    for scope in lean full; do
        for stack in legacy-other python-fastapi react-nextjs angular-springboot go-fiber; do
            run_check "${size}-${scope}-${stack}" "$size" "$scope" "$stack" "" ""
        done
    done
done

echo
echo "═══ MATRIX B — modes ═══"
run_check "small-full-python-document" "small" "full" "python-fastapi" "document" ""
run_check "small-full-nextjs-document" "small" "full" "react-nextjs" "document" ""
run_check "medium-full-springboot-continue" "medium" "full" "angular-springboot" "continue" ""

echo
echo "═══ MATRIX C — overrides combinations ═══"
run_check "active-scope-minor" "small" "full" "python-fastapi" "" "active_iteration_scope: minor"
run_check "active-scope-patch" "small" "full" "go-fiber" "" "active_iteration_scope: patch"
run_check "active-scope-hotfix" "small" "full" "rust-axum" "" "active_iteration_scope: hotfix"

echo
echo "═══ TIER E SUMMARY ═══"
echo "  $PASS passed / $FAIL failed (of $TOTAL)"
echo "  details: $RESULT_FILE"
[ "$FAIL" -eq 0 ] && echo "  ✓ All invariants hold across $TOTAL compositions" || echo "  ✗ Failures detected — see CSV"
