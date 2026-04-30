import type { Tool } from "../../loader/schemas.js";
import { renderTemplate } from "./template-engine.js";
import type { GeneratedFile } from "./agent-generator.js";

/**
 * Generates a TypeScript tool file for OpenCode.
 */
export function generateToolFile(tool: Tool): GeneratedFile {
  const content = renderTemplate("tool.ts.hbs", tool);
  return {
    path: `.opencode/tools/${tool.id}.ts`,
    content,
  };
}

/**
 * Generates all tool files for a set of tools.
 */
export function generateAllToolFiles(tools: Tool[]): GeneratedFile[] {
  return tools.map((tool) => generateToolFile(tool));
}
