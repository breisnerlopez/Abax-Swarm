import type { Role } from "../../loader/schemas.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";

// Re-export generateProjectManifest from opencode — the manifest is identical across targets
export { generateProjectManifest } from "../opencode/config-generator.js";

/**
 * Generates .claude/settings.json configuration file.
 * Defines permission levels for Claude Code tools, and optionally
 * registers policy hooks (atomicity / secret redaction / runaway).
 *
 * @param hookCommand — Shell command that invokes the policy hook
 *   script. When provided, the hooks block is emitted with PreToolUse
 *   matching Task|Bash|Write|Edit and PostToolUse matching Task. When
 *   absent (back-compat), no hooks block is emitted.
 */
export function generateClaudeConfig(
  _agents: Role[],
  hookCommand?: string,
): GeneratedFile {
  const config: Record<string, unknown> = {
    permissions: {
      allow: ["Read", "Edit", "Write", "Glob", "Grep"],
      ask: ["Bash", "WebFetch"],
    },
  };

  if (hookCommand) {
    config.hooks = {
      PreToolUse: [
        {
          // Atomicity (Task only) + secret redaction (Bash/Write/Edit/Task).
          // Single matcher with regex alternation — Claude Code dispatches
          // to the same script which decides what to do based on tool_name
          // in the stdin payload.
          matcher: "Task|Bash|Write|Edit",
          hooks: [{ type: "command", command: hookCommand }],
        },
      ],
      PostToolUse: [
        {
          // Runaway notice on Task completions.
          matcher: "Task",
          hooks: [{ type: "command", command: hookCommand }],
        },
      ],
    };
  }

  return {
    path: ".claude/settings.json",
    content: JSON.stringify(config, null, 2) + "\n",
  };
}
