import type { Tool } from "../../loader/schemas.js";
import type { GeneratedFile } from "../opencode/agent-generator.js";
import { renderTemplate } from "./template-engine.js";

/**
 * Generates a markdown tool file for Claude Code.
 */
export function generateToolFile(tool: Tool): GeneratedFile {
  const content = renderTemplate("tool.md.hbs", tool);
  return {
    path: `.claude/tools/${tool.id}.md`,
    content,
  };
}

/**
 * Generates all tool files for a set of tools.
 */
export function generateAllToolFiles(tools: Tool[]): GeneratedFile[] {
  return tools.map((tool) => generateToolFile(tool));
}
