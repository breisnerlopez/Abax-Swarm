import type { Role } from "../../loader/schemas.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";

// Re-export generateProjectManifest from opencode — the manifest is identical across targets
export { generateProjectManifest } from "../opencode/config-generator.js";

/**
 * Generates .claude/settings.json configuration file.
 * Defines permission levels for Claude Code tools.
 */
export function generateClaudeConfig(_agents: Role[]): GeneratedFile {
  const config = {
    permissions: {
      allow: ["Read", "Edit", "Write", "Glob", "Grep"],
      ask: ["Bash", "WebFetch"],
    },
  };

  return {
    path: ".claude/settings.json",
    content: JSON.stringify(config, null, 2) + "\n",
  };
}
