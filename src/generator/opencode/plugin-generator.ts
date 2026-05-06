import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Role,
  TaskContracts,
  SecretPatterns,
  SecretPattern,
  RunawayLimits,
  PhaseDeliverables,
  Stack,
  IterationScopes,
} from "../../loader/schemas.js";
import type { ProjectConfig } from "../../engine/types.js";
import type { GeneratedFile } from "./agent-generator.js";
import { resolveWithFallback } from "../../engine/role-fallback.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// templates/ is sibling to src/ in the package layout.
const TEMPLATE_PATH = join(__dirname, "../../../templates/opencode/plugins/abax-policy.ts");

/**
 * Computes the merged abax-policies.json that the runtime plugin reads, and
 * returns it together with the plugin source file. Two GeneratedFile entries:
 *
 *   1. `.opencode/plugins/abax-policy.ts`
 *      The plugin source, copied verbatim from
 *      `templates/opencode/plugins/abax-policy.ts`. Generic — it never
 *      hardcodes a project's roles, stacks or rules.
 *
 *   2. `.opencode/policies/abax-policies.json`
 *      The merged policy set: data/rules baselines + project-level
 *      overlays (taskContractsOverride, secretPatternsExtra,
 *      runawayLimitsOverride) + role→category map computed from the
 *      resolved team. Plain JSON so the plugin needs zero runtime deps.
 *
 * Inputs are immutable; this function returns new objects.
 */
export function generatePluginFiles(
  config: ProjectConfig,
  resolvedRoles: Role[],
  baselineTaskContracts: TaskContracts,
  baselineSecretPatterns: SecretPatterns,
  baselineRunawayLimits: RunawayLimits,
  /** Phase definitions from data/rules/phase-deliverables.yaml. Required by
   * the phase-state and verify-deliverable tools to evaluate gates and run
   * verification commands. The plugin itself ignores this section. */
  phaseDeliverables?: PhaseDeliverables,
  /** Resolved stack object — its frontend/backend `test_command` and
   * `build_command` fields are used to resolve {stack.X.Y} placeholders
   * in deliverable verification commands. */
  stack?: Stack,
  /** Iteration scope baseline + project overlay. Plugin reads this to
   * enforce phase-scope constraints when an active scope is declared
   * via .opencode/iteration-state.json. */
  baselineIterationScopes?: IterationScopes,
): GeneratedFile[] {
  const pluginSource = readPluginTemplate();

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
    // Resolve responsible/approver fallbacks per deliverable against the
    // actual team. Deliverables with NO resolvable responsible (and
    // mandatory) are dropped — they couldn't be delegated by the
    // orchestrator anyway. This makes the runtime tools (phase-state,
    // verify-deliverable, attest-deliverable) see only deliverables
    // the team can produce.
    const teamIds = new Set(resolvedRoles.map((r) => r.id));
    policies.phases = phaseDeliverables.phases.map((p) => {
      const filtered = p.deliverables
        .map((d) => {
          const resolvedResp = resolveWithFallback(
            d.responsible,
            d.responsible_fallback,
            teamIds,
          );
          if (!resolvedResp) {
            // No team member can produce this deliverable — drop it from
            // the runtime view regardless of mandatory. The runtime tools
            // (phase-state, attest-deliverable, verify-deliverable) only
            // see deliverables the team can actually deliver.
            return null;
          }
          const resolvedApp = resolveWithFallback(
            d.approver,
            d.approver_fallback,
            teamIds,
          );
          return {
            ...d,
            responsible: resolvedResp,
            approver: resolvedApp ?? d.approver,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { ...p, deliverables: filtered };
    });
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
    { path: ".opencode/plugins/abax-policy.ts", content: pluginSource },
    {
      path: ".opencode/policies/abax-policies.json",
      content: JSON.stringify(policies, null, 2) + "\n",
    },
  ];
}

/**
 * Project a Stack into the minimal shape that the runtime tools need:
 * just the executable commands per layer. Avoids leaking the full stack
 * object (description, role_context, etc.) into the runtime JSON.
 */
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

/** Path to the generated plugin file, used by config-generator. */
export const PLUGIN_OPENCODE_PATH = ".opencode/plugins/abax-policy.ts";

// ---- Merge helpers (exported for unit testing) ----

/**
 * Merge by `id`: overlay entries with the same id REPLACE baseline entries;
 * new ids are added; baseline ids without overlay are kept. Symmetric for
 * atomic_actions, forbidden_combinations and exemptions.
 */
export function mergeTaskContracts(
  base: TaskContracts,
  overlay?: Partial<TaskContracts>,
): TaskContracts {
  if (!overlay) return base;
  return {
    atomic_actions: mergeById(base.atomic_actions, overlay.atomic_actions ?? []),
    forbidden_combinations: mergeById(
      base.forbidden_combinations,
      overlay.forbidden_combinations ?? [],
    ),
    exemptions: mergeByKey(
      base.exemptions,
      overlay.exemptions ?? [],
      (e) => e.role,
    ),
  };
}

/**
 * Concatenate baseline patterns with project extras. If an extra carries an
 * id that already exists in baseline, the extra wins (full replacement of
 * that pattern entry).
 */
export function mergeSecretPatterns(
  base: SecretPatterns,
  extras?: SecretPattern[],
): SecretPatterns {
  if (!extras || extras.length === 0) return base;
  return { patterns: mergeById(base.patterns, extras) };
}

/**
 * Merge iteration scopes by `id`. Overlay scope replaces baseline
 * scope of same id; new ids added; baseline ids without overlay are
 * preserved. Mirrors mergeTaskContracts.forbidden_combinations.
 */
export function mergeIterationScopes(
  base: IterationScopes,
  overlay?: Partial<IterationScopes>,
): IterationScopes {
  if (!overlay) return base;
  return {
    scopes: mergeById(base.scopes, overlay.scopes ?? []),
    require_scope_for_phases:
      overlay.require_scope_for_phases ?? base.require_scope_for_phases,
  };
}

/**
 * Field-by-field merge of runaway limits. `default` merges field-by-field;
 * `by_category` and `by_role` merge by key (overlay key replaces baseline
 * key entirely — limits objects are small enough that field-level merging
 * inside them would be confusing).
 */
export function mergeRunawayLimits(
  base: RunawayLimits,
  overlay?: Partial<RunawayLimits>,
): RunawayLimits {
  if (!overlay) return base;
  return {
    default: { ...base.default, ...(overlay.default ?? {}) },
    by_category: { ...base.by_category, ...(overlay.by_category ?? {}) },
    by_role: { ...base.by_role, ...(overlay.by_role ?? {}) },
  };
}

function mergeById<T extends { id: string }>(base: T[], overlay: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of overlay) map.set(item.id, item);
  return Array.from(map.values());
}

function mergeByKey<T>(base: T[], overlay: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(key(item), item);
  for (const item of overlay) map.set(key(item), item);
  return Array.from(map.values());
}

function readPluginTemplate(): string {
  // Read once at generate time. Template is shipped with the package.
  return readFileSync(TEMPLATE_PATH, "utf8");
}
