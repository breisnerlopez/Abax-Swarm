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

interface AbaxPolicies {
  task_contracts?: TaskContracts;
  secret_patterns?: SecretPatterns;
  runaway_limits?: RunawayLimits;
  /** Map roleId → category, used by runaway lookup. Generated alongside
   * the policies because the plugin doesn't know the team composition. */
  role_categories?: Record<string, string>;
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
