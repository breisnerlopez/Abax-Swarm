import type { Role, Skill } from "../loader/schemas.js";

/**
 * Given a set of selected roles, resolves all needed skills.
 * Deduplicates and returns unique skill IDs.
 */
export function resolveSkills(
  roleIds: string[],
  rolesMap: Map<string, Role>,
): string[] {
  const skillIds = new Set<string>();

  for (const roleId of roleIds) {
    const role = rolesMap.get(roleId);
    if (!role) continue;

    for (const skillId of role.skills) {
      skillIds.add(skillId);
    }
  }

  return Array.from(skillIds).sort();
}

/**
 * Filters the skills map to only include resolved skills.
 * Returns missing skill IDs as warnings.
 */
export function filterSkills(
  skillIds: string[],
  skillsMap: Map<string, Skill>,
): { found: Skill[]; missing: string[] } {
  const found: Skill[] = [];
  const missing: string[] = [];

  for (const id of skillIds) {
    const skill = skillsMap.get(id);
    if (skill) {
      found.push(skill);
    } else {
      missing.push(id);
    }
  }

  return { found, missing };
}
