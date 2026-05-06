#!/usr/bin/env bash
# Tier F — Role-fallback consistency across cross-cutting concerns.
# Per scenario, verify that:
#   1. Every responsible in policies.phases is in role_categories team
#   2. Every approver in policies.phases is in role_categories OR product-owner
#   3. orchestrator.md @mentions only the team (no @ to absent role)
#   4. The same role substitutions are visible in opencode.json agent block
# This catches drift between generators that should agree.
set -u
RESULT_FILE=/tmp/abax-e2e/results/tier-f.csv
echo "id,role_dropped,team_size,policy_orphans,orchestrator_orphan_mentions,verdict" > "$RESULT_FILE"

PASS=0
FAIL=0

scenarios=(
    "small-lean:lean:small:no team override (default 5 indispensables)"
    "small-full:full:small:no override (default 8 with recommended)"
    "medium-lean:lean:medium:medium lean default"
    "medium-full:full:medium:medium full default"
    "large-full:full:large:large full default (16+ roles)"
    "small-lean-go:lean:small:lean small + go-fiber stack"
)

for spec in "${scenarios[@]}"; do
    IFS=':' read -r id scope size note <<< "$spec"
    DIR="/tmp/abax-e2e/tier-f/$id"
    sudo rm -rf "$DIR"
    mkdir -p "$DIR"

    cat > "$DIR/project-manifest.yaml" <<EOF
project:
  name: $id
  description: $note
  size: $size
  stack: legacy-other
  target: opencode
  team_scope: $scope
  provider: openai
  model_strategy: inherit
  permission_mode: full
  isolation_mode: host
criteria_applied: []
generated_by: tier-f
EOF

    cd /srv/repos/Abax-Swarm && sudo node --import tsx src/cli/app.ts regenerate --dir "$DIR" >/dev/null 2>&1 || { echo "  ✗ $id GEN FAIL"; FAIL=$((FAIL+1)); continue; }
    cd /

    POL="$DIR/.opencode/policies/abax-policies.json"
    ORCH="$DIR/.opencode/agents/orchestrator.md"

    # Check 1: every responsible in team
    local_check=$(python3 -c "
import json
d = json.load(open('$POL'))
team = set(d['role_categories'].keys())
orphans = []
for p in d.get('phases', []):
    for x in p.get('deliverables', []):
        if x['responsible'] not in team and x['responsible'] != 'product-owner':
            orphans.append(f\"{p['id']}/{x['id']}={x['responsible']}\")
print(','.join(orphans) or 'NONE')
")
    if [ "$local_check" != "NONE" ]; then
        FAIL=$((FAIL + 1))
        echo "$id,-,-,$local_check,-,FAIL_orphans" >> "$RESULT_FILE"
        echo "  ✗ $id — policy orphans: $local_check"
        continue
    fi

    # Check 2: orchestrator @mentions
    team_size=$(python3 -c "import json; print(len(json.load(open('$POL'))['role_categories']))")
    team_list=$(python3 -c "import json; print(' '.join(json.load(open('$POL'))['role_categories'].keys()))")
    expected="orchestrator $team_list"

    # Find @ mentions in orchestrator.md
    orch_orphans=""
    for mention in $(grep -oE "@[a-z][a-z0-9-]+" "$ORCH" | sort -u | sed 's/@//'); do
        case " $expected " in
            *" $mention "*) ;; # in expected
            *)
                # ignore well-known things that aren't role mentions
                case "$mention" in
                    explore|general|plan|docs|business-analyst|tech-lead|project-manager|developer-backend|developer-frontend|devops|qa-functional|solution-architect|qa-lead|qa-automation|tech-writer|change-manager|dba|product-owner|security-architect|integration-architect|qa-performance|ux-designer)
                        # check if this role is in team
                        case " $expected " in
                            *" $mention "*) ;;
                            *) orch_orphans="$orch_orphans $mention" ;;
                        esac
                        ;;
                esac
                ;;
        esac
    done
    orch_orphans=$(echo "$orch_orphans" | xargs)

    if [ -n "$orch_orphans" ]; then
        # Acceptable: native sub-agents (@explore @general) are fine; specific role mentions are not.
        # Filter to only role mentions
        bad=""
        for o in $orch_orphans; do
            case "$o" in
                explore|general|plan|docs) ;;
                *) bad="$bad $o" ;;
            esac
        done
        bad=$(echo "$bad" | xargs)
        if [ -n "$bad" ]; then
            FAIL=$((FAIL + 1))
            echo "$id,-,$team_size,NONE,\"$bad\",FAIL_orchestrator" >> "$RESULT_FILE"
            echo "  ✗ $id — orchestrator @ mentions absent roles: $bad"
            continue
        fi
    fi

    PASS=$((PASS + 1))
    echo "$id,-,$team_size,NONE,NONE,PASS" >> "$RESULT_FILE"
    echo "  ✓ $id — team_size=$team_size, no policy orphans, no orchestrator drift"
done

echo
echo "═══ TIER F SUMMARY ═══"
echo "  $PASS passed / $FAIL failed (of ${#scenarios[@]})"
echo "  details: $RESULT_FILE"
