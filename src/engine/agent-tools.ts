import type { Role } from "../loader/schemas.js";

/**
 * OpenCode built-in tools that an agent might be asked to call.
 *
 * Order is the recommended order of preference for documents/code work
 * (read/write first, dev affordances after). The template prints this list
 * verbatim, so order matters for prompt readability.
 */
const BUILTIN_TOOLS = [
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "bash",
  "webfetch",
  "websearch",
  "skill",
] as const;

export interface AgentToolsView {
  /** Built-in tools the agent CAN call, plus its custom tool IDs. */
  allowed: string[];
  /** Built-in tools the agent is explicitly blocked from calling. */
  denied: string[];
  /** Custom tools (from role.tools[]). Subset of `allowed`. */
  custom: string[];
}

/**
 * Returns a per-agent tool view to embed in the agent prompt.
 *
 * Why this exists (0.1.38):
 * OpenCode rejects calls to denied tools at runtime with `tool: invalid`. The
 * LLM has no static way to know which tools are off-limits for its role, so
 * it picks the most ergonomic one (e.g. `bash` for `mkdir -p`) and burns a
 * round trip on a rejection. Real incident: the @business-analyst tried to
 * call bash to mkdir a directory it then immediately wrote a file into —
 * `write` auto-creates parents, so the bash call was redundant *and* denied.
 *
 * Embedding this list in the prompt under "Herramientas disponibles" lets the
 * model pick the right tool on the first try.
 *
 * Rule:
 *   denied  ← perms[t] === "deny"  OR  tools_enabled[t] === false
 *   allowed ← every other built-in (default behaviour: not denied = available)
 *           + custom tools from role.tools (always exposed at root scope by
 *             the OpenCode generator).
 */
export function computeAgentTools(role: Role): AgentToolsView {
  const perms = role.agent.permissions;
  const enabled = role.agent.tools_enabled;

  const allowed: string[] = [];
  const denied: string[] = [];

  for (const tool of BUILTIN_TOOLS) {
    const isDenied = perms[tool] === "deny" || enabled[tool] === false;
    if (isDenied) denied.push(tool);
    else allowed.push(tool);
  }

  const custom = [...role.tools].sort();
  for (const t of custom) allowed.push(t);

  return { allowed, denied, custom };
}
