import type { ProjectSize, SizeMatrix, CriteriaRules } from "../loader/schemas.js";
import type { RoleSelection, TeamScope } from "./types.js";

/**
 * Selects roles based on project size using the size matrix.
 * scope "lean" = indispensable only, "full" = indispensable + recommended.
 */
export function selectBySize(size: ProjectSize, matrix: SizeMatrix, scope: TeamScope = "full"): RoleSelection[] {
  const sizeData = matrix.roles_by_size[size];
  const selections: RoleSelection[] = [];

  for (const roleId of sizeData.indispensable) {
    selections.push({
      roleId,
      reason: "indispensable",
      removable: false,
    });
  }

  if (scope === "full") {
    for (const roleId of sizeData.recommended) {
      if (!selections.some((s) => s.roleId === roleId)) {
        selections.push({
          roleId,
          reason: "recommended",
          removable: true,
        });
      }
    }
  }

  return selections;
}

/**
 * Applies criteria rules to add additional roles based on project characteristics.
 * Roles added by criteria are removable unless they were already indispensable.
 */
export function applyCriteria(
  existing: RoleSelection[],
  activeCriteriaIds: string[],
  criteriaRules: CriteriaRules,
): RoleSelection[] {
  const result = [...existing];

  for (const criterionId of activeCriteriaIds) {
    const criterion = criteriaRules.criteria.find((c) => c.id === criterionId);
    if (!criterion) continue;

    for (const roleId of criterion.adds_roles) {
      if (!result.some((s) => s.roleId === roleId)) {
        result.push({
          roleId,
          reason: "criteria",
          criteriaSource: criterionId,
          removable: true,
        });
      }
    }
  }

  return result;
}

/**
 * Full role selection: size matrix + criteria.
 */
export function selectRoles(
  size: ProjectSize,
  activeCriteriaIds: string[],
  matrix: SizeMatrix,
  criteriaRules: CriteriaRules,
  scope: TeamScope = "full",
): RoleSelection[] {
  const bySize = selectBySize(size, matrix, scope);
  return applyCriteria(bySize, activeCriteriaIds, criteriaRules);
}
