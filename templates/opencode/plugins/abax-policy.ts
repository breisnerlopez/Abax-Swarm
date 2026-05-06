/**
 * Abax policy plugin — generic enforcement of the manifest contract.
 *
 * Registered in opencode.json as:
 *   { "plugin": [".opencode/plugins/abax-policy.ts"] }
 *
 * Reads its baseline+overlay policies from `.opencode/policies/abax-policies.json`
 * (computed by the generator from data/rules/*.yaml + project-manifest.yaml).
 * Three concerns, one plugin:
 *
 *   1. Task atomicity — refuse `task` delegations whose prompt mixes
 *      forbidden combinations of atomic actions (e.g. fix + test +
 *      commit + push). Generic across roles; customisable per project.
 *
 *   2. Secret redaction — refuse / warn when bash, write, edit, or task
 *      args contain a credential matching one of the configured patterns
 *      (OpenAI keys, AWS keys, GitHub PATs, etc.).
 *
 *   3. Runaway detection — emit a notice when a `task` sub-session's
 *      output (size proxy for parts/tokens) exceeds the configured
 *      limit. Never blocks — the orchestrator decides what to do with
 *      the notice.
 *
 * Architecture decisions:
 *
 * - Single plugin file. opencode.json `plugin` is an array, but bundling
 *   three concerns in one file keeps the runtime lookup cheap and the
 *   import surface trivial.
 *
 * - Reads JSON, not YAML. The generator pre-merges baseline + overlay
 *   into JSON so the plugin has zero runtime dependencies.
 *
 * - All policies are silent no-ops if the JSON file is missing or any
 *   section is empty. Failing-open here is intentional: a broken policy
 *   file should not block work.
 *
 * - The plugin assumes `tool.execute.before` and `tool.execute.after`
 *   fire for the `task` tool. If your opencode build does not route
 *   task delegations through the tool layer, the atomicity and runaway
 *   checks become no-ops (secret redaction still works on bash/write/edit).
 *   See the bottom of this file for an empirical diagnostic logger you
 *   can enable by setting ABAX_POLICY_DEBUG=1.
 */
import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

// ---- Policy types (mirror /srv/repos/Abax-Swarm/src/loader/schemas.ts) ----

interface AtomicAction {
  id: string;
  keywords: string[];
}
interface ForbiddenCombo {
  id: string;
  actions: string[];
  reason: string;
}
interface ContractExemption {
  role: string;
  allow_combinations: string[];
}
interface TaskContracts {
  atomic_actions: AtomicAction[];
  forbidden_combinations: ForbiddenCombo[];
  exemptions: ContractExemption[];
}

interface SecretPattern {
  id: string;
  regex: string;
  severity: "block" | "warn";
  description: string;
}
interface SecretPatterns {
  patterns: SecretPattern[];
}

interface Limits {
  parts_max?: number;
  duration_min_max?: number;
  tokens_max?: number;
}
interface RunawayLimits {
  default: Limits;
  by_category: Record<string, Limits>;
  by_role: Record<string, Limits>;
}

interface IterationScope {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  skip_phases: string[];
  minimal_phases: Record<string, string[]>;
  full_phases: string[];
  default_layout_strategy: string;
}
interface IterationScopes {
  scopes: IterationScope[];
  require_scope_for_phases: string[];
}

interface AbaxPolicies {
  task_contracts?: TaskContracts;
  secret_patterns?: SecretPatterns;
  runaway_limits?: RunawayLimits;
  /** Map roleId → category, used by runaway lookup. Generated alongside
   * the policies because the plugin doesn't know the team composition. */
  role_categories?: Record<string, string>;
  /** Catalog of declared iteration scopes (major/minor/patch/hotfix etc).
   * The plugin's phase-scope enforcement reads the active scope id from
   * .opencode/iteration-state.json and looks up the rules here. */
  iteration_scopes?: IterationScopes;
  /** When set in the manifest (`active_iteration_scope:` top-level), the
   * plugin enforces from session start without needing the
   * iteration-state file. Useful for fully-scripted iterations. */
  active_iteration_scope?: string;
}

// ---- Pure functions (module-private) ----
// NOTE: these are intentionally NOT exported. opencode's plugin loader
// (Bun-based) appears to introspect exported functions at load time — when
// they were exported, Bun emitted a misleading "X.toLowerCase is not a
// function" error during plugin init (the hooks still wired up correctly
// afterwards, but the noise made debugging harder). Keeping them private
// avoids the introspection path entirely.

/**
 * Detect which atomic actions appear in a free-text task prompt.
 * Case-insensitive substring match — keyword vocabularies are usually
 * short verbs/phrases so substring tolerates morphology ("compila",
 * "compilando"). Parameter named `text` (not `prompt`) to avoid the
 * Bun/Web `globalThis.prompt` global.
 */
function detectActions(text: string, actions: AtomicAction[]): Set<string> {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const a of actions) {
    for (const kw of a.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        found.add(a.id);
        break;
      }
    }
  }
  return found;
}

/**
 * Find every forbidden_combination whose required actions are all detected.
 * Returns the matched combos so the caller can format the error.
 */
function findViolations(
  detected: Set<string>,
  combos: ForbiddenCombo[],
  role: string,
  exemptions: ContractExemption[],
): ForbiddenCombo[] {
  const exemptIds = new Set(
    exemptions.find((e) => e.role === role)?.allow_combinations ?? [],
  );
  const out: ForbiddenCombo[] = [];
  for (const combo of combos) {
    if (exemptIds.has(combo.id)) continue;
    if (combo.actions.every((a) => detected.has(a))) {
      out.push(combo);
    }
  }
  return out;
}

/**
 * Scan text for any secret pattern. Returns matches with their pattern
 * metadata. Caller decides whether to block (severity:block) or just warn.
 */
function scanSecrets(text: string, patterns: SecretPattern[]): Array<{
  pattern: SecretPattern;
  preview: string;
}> {
  const hits: Array<{ pattern: SecretPattern; preview: string }> = [];
  for (const p of patterns) {
    let re: RegExp;
    try {
      re = new RegExp(p.regex);
    } catch {
      continue;
    }
    const m = text.match(re);
    if (m) {
      // Redacted preview: first 6 chars + length, never the full match.
      const sample = m[0];
      const preview = `${sample.slice(0, 6)}…(${sample.length} chars)`;
      hits.push({ pattern: p, preview });
    }
  }
  return hits;
}

/**
 * Detect the phase id a task delegation targets, by scanning the args
 * for known phase ids. Inputs:
 *   - args.phase                    (explicit, if orchestrator passes it)
 *   - args.description / args.prompt (text scan, fallback)
 * Returns null if no phase can be identified — the enforcer will then
 * skip phase-scope blocking for that delegation (fail-open, since we
 * can't safely block what we can't classify).
 */
function detectTaskPhase(args: any, knownPhaseIds: string[]): string | null {
  if (!args || typeof args !== "object") return null;
  if (typeof args.phase === "string" && knownPhaseIds.includes(args.phase)) {
    return args.phase;
  }
  const haystack = (
    String(args.description ?? "") + " " + String(args.prompt ?? "")
  ).toLowerCase();
  for (const id of knownPhaseIds) {
    if (haystack.includes(id.toLowerCase())) return id;
  }
  return null;
}

/**
 * Read the active iteration scope id from session state. Order:
 *   1. explicit `active_iteration_scope` in policies (manifest pin)
 *   2. .opencode/iteration-state.json (set at runtime by orchestrator)
 *   3. null (no enforcement)
 */
function loadActiveScopeId(
  policies: AbaxPolicies,
  projectDir: string,
): string | null {
  if (policies.active_iteration_scope) return policies.active_iteration_scope;
  const statePath = join(projectDir, ".opencode/iteration-state.json");
  if (!existsSync(statePath)) return null;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    return typeof state.active_scope === "string" ? state.active_scope : null;
  } catch {
    return null;
  }
}

/**
 * Detect iteration signals — does the project have history that implies
 * a previous closed iteration? If yes, the orchestrator MUST set an
 * iteration scope before delegating phase 0/1 work. Implements the
 * runtime side of the iteration-strategy skill mandate.
 */
function detectIterationLikely(projectDir: string): boolean {
  const bitacora = existsSync(join(projectDir, "docs/bitacora.md"));
  const closurePhase = existsSync(join(projectDir, "docs/entregables/fase-9-cierre"));
  let changelogReleases = false;
  const changelog = join(projectDir, "CHANGELOG.md");
  if (existsSync(changelog)) {
    try {
      const text = readFileSync(changelog, "utf8");
      changelogReleases = /^## \[\d/m.test(text);
    } catch {
      changelogReleases = false;
    }
  }
  return bitacora || closurePhase || changelogReleases;
}

/**
 * Resolve effective limits for a role: by_role > by_category > default.
 * Returns the merged limits object (every field defined or undefined).
 */
function resolveLimits(
  role: string,
  limits: RunawayLimits | undefined,
  roleCategory: Record<string, string> | undefined,
): Limits {
  if (!limits) return {};
  const byRole = limits.by_role[role];
  const cat = roleCategory?.[role];
  const byCat = cat ? limits.by_category[cat] : undefined;
  const def = limits.default ?? {};
  return {
    parts_max: byRole?.parts_max ?? byCat?.parts_max ?? def.parts_max,
    duration_min_max:
      byRole?.duration_min_max ?? byCat?.duration_min_max ?? def.duration_min_max,
    tokens_max: byRole?.tokens_max ?? byCat?.tokens_max ?? def.tokens_max,
  };
}

// ---- Plugin entry point ----

const PLUGIN: Plugin = async (input) => {
  const policiesPath = join(input.directory, ".opencode/policies/abax-policies.json");
  let policies: AbaxPolicies = {};
  if (existsSync(policiesPath)) {
    try {
      policies = JSON.parse(readFileSync(policiesPath, "utf8"));
    } catch (err) {
      // Fail-open with a stderr breadcrumb. We never want a malformed policy
      // file to block work.
      console.error(`[abax-policy] could not parse ${policiesPath}: ${(err as Error).message}`);
    }
  }

  const debugLog = process.env.ABAX_POLICY_DEBUG ? join(input.directory, ".opencode/abax-policy-debug.log") : null;
  const dbg = (msg: string) => {
    if (debugLog) appendFileSync(debugLog, `${new Date().toISOString()} ${msg}\n`);
  };

  // Track sub-session start times for the runaway check.
  const taskStarts = new Map<string, number>();

  return {
    "tool.execute.before": async (i, o) => {
      const tool = (i.tool ?? "").toLowerCase();
      dbg(`before tool=${tool} args.keys=${Object.keys(o.args ?? {}).join(",")}`);

      // ---- Secret redaction (applies to any tool that carries text) ----
      if (policies.secret_patterns) {
        const fields = collectScannableText(tool, o.args);
        for (const text of fields) {
          const hits = scanSecrets(text, policies.secret_patterns.patterns);
          for (const h of hits) {
            if (h.pattern.severity === "block") {
              throw new Error(
                `[abax-policy/secret] blocked: matched pattern "${h.pattern.id}" (${h.pattern.description}). Preview: ${h.preview}. Rotate the secret and retry.`,
              );
            } else {
              console.warn(
                `[abax-policy/secret] WARN: matched pattern "${h.pattern.id}" (${h.pattern.description}) in tool=${tool}. Preview: ${h.preview}.`,
              );
            }
          }
        }
      }

      // ---- Phase-scope enforcement (only for task delegations) ----
      // Skips delegations to phases that the active iteration scope
      // marks as `skip_phases`. Fail-open if no scope is active, no
      // catalog is loaded, or the target phase can't be detected.
      if (tool === "task" && policies.iteration_scopes) {
        const activeId = loadActiveScopeId(policies, input.directory);
        // Phase id catalog: union of phase-deliverables ids AND any
        // phase referenced by iteration-scopes (skip_phases /
        // minimal_phases / full_phases / require_scope_for_phases).
        // This recognises "virtual" phases like "discovery" which is
        // narrative in the orchestrator template and not in the
        // deliverables list, but IS a meaningful scope target.
        const phaseDeliverableIds: string[] = ((policies as any).phases ?? []).map(
          (p: any) => p.id as string,
        );
        const scopeRefIds = new Set<string>();
        for (const s of policies.iteration_scopes.scopes) {
          for (const p of s.skip_phases) scopeRefIds.add(p);
          for (const p of Object.keys(s.minimal_phases)) scopeRefIds.add(p);
          for (const p of s.full_phases) scopeRefIds.add(p);
        }
        for (const p of policies.iteration_scopes.require_scope_for_phases || []) {
          scopeRefIds.add(p);
        }
        const allPhasesAtRoot: string[] = [
          ...new Set([...phaseDeliverableIds, ...scopeRefIds]),
        ];

        // ---- Skill invocation contract (M2.1) ----
        // When the project has iteration signals AND no active scope is
        // set AND the delegation targets a phase listed in
        // require_scope_for_phases → BLOCK. Forces the orchestrator to
        // call set-iteration-scope before phase 0/1 work in iterations
        // on closed projects (the iteration-strategy skill mandate).
        if (!activeId) {
          const required = policies.iteration_scopes.require_scope_for_phases || [];
          if (required.length > 0 && detectIterationLikely(input.directory)) {
            const phaseId = detectTaskPhase(o.args, allPhasesAtRoot);
            if (phaseId && required.includes(phaseId)) {
              throw new Error(
                `[abax-policy/iteration-scope] blocked task delegation: project has iteration signals (bitácora/CHANGELOG/closure phase) but no active_iteration_scope is set, and phase "${phaseId}" requires explicit scope confirmation.\n` +
                  `\n` +
                  `Action required: ASK THE USER which iteration type applies (major/minor/patch/hotfix) and then call the set-iteration-scope tool with their answer. The iteration-strategy skill describes the question to ask.\n` +
                  `\n` +
                  `If the user truly wants a full new-version cascade (major), set scope_id="major" and proceed. For improvements/fixes use minor/patch/hotfix.`,
              );
            }
          }
        }

        if (activeId) {
          const scope = policies.iteration_scopes.scopes.find((s) => s.id === activeId);
          if (scope) {
            const phaseId = detectTaskPhase(o.args, allPhasesAtRoot);
            if (phaseId) {
              if (scope.skip_phases.includes(phaseId)) {
                throw new Error(
                  `[abax-policy/iteration-scope] blocked task delegation: phase "${phaseId}" is in skip_phases for active scope "${scope.id}" (${scope.name}).\n` +
                    `Reason: ${scope.description.split("\n")[0]}\n` +
                    `If this delegation is genuinely needed, use the set-iteration-scope tool to widen the scope, or remove the phase from skip_phases in iteration_scopes_override.`,
                );
              }
              const minimal = scope.minimal_phases[phaseId];
              if (Array.isArray(minimal) && minimal.length > 0) {
                // Try to extract a deliverable id from the args. Same
                // detection strategy as phases — fail-open if absent.
                const delivId = String(o.args?.deliverable ?? "");
                if (delivId && !minimal.includes(delivId)) {
                  throw new Error(
                    `[abax-policy/iteration-scope] blocked task delegation: deliverable "${delivId}" is NOT in the minimal_phases allowlist for phase "${phaseId}" under active scope "${scope.id}" (${scope.name}).\n` +
                      `Allowed: ${minimal.join(", ")}.`,
                  );
                }
              }
            }
          }
        }
      }

      // ---- Atomicity check (only for task delegations) ----
      if (tool === "task" && policies.task_contracts) {
        // Local var named `taskPrompt` (not `prompt`) — see detectActions docstring.
        const taskPrompt = String(o.args?.prompt ?? o.args?.description ?? "");
        const role = String(o.args?.subagent_type ?? o.args?.agent ?? "");
        if (taskPrompt) {
          const actions = detectActions(taskPrompt, policies.task_contracts.atomic_actions);
          const violations = findViolations(
            actions,
            policies.task_contracts.forbidden_combinations,
            role,
            policies.task_contracts.exemptions,
          );
          if (violations.length > 0) {
            const summary = violations.map((v) => `  • ${v.id}: ${v.reason.split("\n")[0]}`).join("\n");
            throw new Error(
              `[abax-policy/atomicity] blocked task delegation to "${role || "?"}": forbidden combination(s) detected.\n` +
                `Detected actions: ${[...actions].join(", ")}\n` +
                `Violations:\n${summary}\n` +
                `Split this Task into smaller atomic Tasks (one responsibility each).`,
            );
          }
          taskStarts.set(i.callID, Date.now());
        }
      }
    },

    "tool.execute.after": async (i, o) => {
      const tool = (i.tool ?? "").toLowerCase();
      dbg(`after tool=${tool} output.size=${(o.output ?? "").length}`);

      // ---- Runaway notice (only for task) ----
      if (tool === "task" && policies.runaway_limits) {
        const role = String(i.args?.subagent_type ?? i.args?.agent ?? "");
        const limits = resolveLimits(role, policies.runaway_limits, policies.role_categories);
        const start = taskStarts.get(i.callID);
        const durationMin = start ? (Date.now() - start) / 60000 : undefined;
        taskStarts.delete(i.callID);

        // Heuristic: opencode doesn't expose parts count to the post-hook,
        // so we use output length as a proxy for "size of the sub-session
        // result". For a precise parts count, the orchestrator would need
        // to query the SDK; that path is documented but not implemented here.
        const outputChars = (o.output ?? "").length;
        const PARTS_PROXY_FACTOR = 250; // ~250 chars per part avg in practice
        const partsApprox = Math.round(outputChars / PARTS_PROXY_FACTOR);

        const breaches: string[] = [];
        if (limits.parts_max && partsApprox > limits.parts_max) {
          breaches.push(`parts≈${partsApprox} > ${limits.parts_max}`);
        }
        if (limits.duration_min_max && durationMin && durationMin > limits.duration_min_max) {
          breaches.push(`duration=${durationMin.toFixed(1)}min > ${limits.duration_min_max}`);
        }
        if (breaches.length > 0) {
          // NEVER block. Stderr notice — the orchestrator (or a separate
          // monitor) can pick this up and decide whether to escalate.
          console.warn(
            `[abax-policy/runaway] notice: task to "${role || "?"}" exceeded limit(s): ${breaches.join("; ")}.`,
          );
        }
      }
    },
  };
};

/**
 * Pick out the string fields of `args` that should be scanned for secrets.
 * Tool-specific because args shape varies.
 */
function collectScannableText(tool: string, args: any): string[] {
  if (!args || typeof args !== "object") return [];
  switch (tool) {
    case "bash":
      return [String(args.command ?? "")];
    case "write":
      return [String(args.content ?? "")];
    case "edit":
      return [String(args.new_string ?? ""), String(args.old_string ?? "")];
    case "task":
      return [String(args.prompt ?? ""), String(args.description ?? "")];
    default:
      // Generic fallback: scan every string-valued top-level arg. Catches
      // custom tools that carry text (e.g. send-message, http-post).
      return Object.values(args)
        .filter((v): v is string => typeof v === "string")
        .slice(0, 8); // cap to avoid pathological cases
  }
}

export default PLUGIN;
