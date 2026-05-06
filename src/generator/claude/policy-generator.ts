import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Role,
  TaskContracts,
  SecretPatterns,
  RunawayLimits,
  PhaseDeliverables,
  Stack,
  IterationScopes,
} from "../../loader/schemas.js";
import type { ProjectConfig } from "../../engine/types.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";
import {
  mergeTaskContracts,
  mergeSecretPatterns,
  mergeRunawayLimits,
  mergeIterationScopes,
} from "../opencode/plugin-generator.js";
import { resolveDeliverablesForTeam } from "../../engine/role-fallback.js";
import { CC_HOOK_PATH, CC_POLICIES_PATH } from "../../engine/paths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, "../../../templates/claude/hooks/abax-policy.py");

/**
 * Claude target equivalent of opencode's generatePluginFiles. Emits:
 *
 *   .claude/hooks/abax-policy.py            — Python hook script
 *   .claude/policies/abax-policies.json     — same merged policies as opencode
 *
 * The hook script is registered by config-generator.ts in the
 * .claude/settings.json `hooks` block. Reuses the merge helpers from the
 * opencode side — the merged policies content is identical regardless of
 * target. Only the runtime that consumes it differs.
 */
export function generateClaudePolicyFiles(
  config: ProjectConfig,
  resolvedRoles: Role[],
  baselineTaskContracts: TaskContracts,
  baselineSecretPatterns: SecretPatterns,
  baselineRunawayLimits: RunawayLimits,
  phaseDeliverables?: PhaseDeliverables,
  stack?: Stack,
  baselineIterationScopes?: IterationScopes,
): GeneratedFile[] {
  const hookSource = readFileSync(TEMPLATE_PATH, "utf8");

  const policies: Record<string, unknown> = {
    task_contracts: mergeTaskContracts(
      baselineTaskContracts,
      config.taskContractsOverride,
    ),
    secret_patterns: mergeSecretPatterns(
      baselineSecretPatterns,
      config.secretPatternsExtra,
    ),
    runaway_limits: mergeRunawayLimits(
      baselineRunawayLimits,
      config.runawayLimitsOverride,
    ),
    role_categories: Object.fromEntries(
      resolvedRoles.map((r) => [r.id, r.category]),
    ),
  };

  if (phaseDeliverables) {
    // Resolve responsible/approver fallbacks against the actual team via
    // the shared helper — identical behaviour to opencode/plugin-generator.
    // Without this, Claude target users would see policies.phases with
    // orphan responsibles (the bug Tier E surfaced in opencode side, that
    // also lived here unnoticed).
    const teamIds = new Set(resolvedRoles.map((r) => r.id));
    policies.phases = resolveDeliverablesForTeam(phaseDeliverables.phases, teamIds);
  }
  if (stack) {
    policies.stacks = stackCommandsForRuntime(stack);
  }
  if (baselineIterationScopes) {
    policies.iteration_scopes = mergeIterationScopes(
      baselineIterationScopes,
      config.iterationScopesOverride,
    );
  }
  if (config.activeIterationScope) {
    policies.active_iteration_scope = config.activeIterationScope;
  }

  return [
    {
      path: CC_HOOK_PATH,
      content: hookSource,
      // chmod is not part of GeneratedFile today; settings.json invokes
      // via `python3 .claude/hooks/abax-policy.py` to avoid relying on
      // executable bit (see HOOK_INVOCATION).
    },
    {
      path: CC_POLICIES_PATH,
      content: JSON.stringify(policies, null, 2) + "\n",
    },
  ];
}

/**
 * Hook invocation string used in .claude/settings.json. Invoking via
 * `python3 <path>` removes any dependency on the executable bit being
 * preserved by the writer.
 */
export const HOOK_INVOCATION = `python3 "$CLAUDE_PROJECT_DIR/${CC_HOOK_PATH}"`;

function stackCommandsForRuntime(stack: Stack): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const layer of ["frontend", "backend"] as const) {
    const data = stack[layer];
    if (!data) continue;
    const cmds: Record<string, string> = {};
    if (data.test_command) cmds.test_command = data.test_command;
    if (data.build_command) cmds.build_command = data.build_command;
    if (Object.keys(cmds).length > 0) out[layer] = cmds;
  }
  return out;
}
