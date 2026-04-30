import type { Role, Tool } from "../loader/schemas.js";

/**
 * Given a set of selected roles, resolves all needed tools.
 * Deduplicates and returns unique tool IDs.
 */
export function resolveTools(
  roleIds: string[],
  rolesMap: Map<string, Role>,
): string[] {
  const toolIds = new Set<string>();

  for (const roleId of roleIds) {
    const role = rolesMap.get(roleId);
    if (!role) continue;

    for (const toolId of role.tools) {
      toolIds.add(toolId);
    }
  }

  return Array.from(toolIds).sort();
}

/**
 * Filters the tools map to only include resolved tools.
 * Returns missing tool IDs as warnings.
 */
export function filterTools(
  toolIds: string[],
  toolsMap: Map<string, Tool>,
): { found: Tool[]; missing: string[] } {
  const found: Tool[] = [];
  const missing: string[] = [];

  for (const id of toolIds) {
    const tool = toolsMap.get(id);
    if (tool) {
      found.push(tool);
    } else {
      missing.push(id);
    }
  }

  return { found, missing };
}
