import type { RaciMatrix, RaciValue } from "../loader/schemas.js";

export interface RaciValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates RACI matrix completeness:
 * - Every activity must have at least one R (Responsible)
 * - Every activity must have at least one A (Accountable) or A/R
 * - No activity should have zero participants
 */
export function validateRaciMatrix(raci: RaciMatrix): RaciValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [activity, roles] of Object.entries(raci.activities)) {
    const entries = Object.entries(roles) as [string, RaciValue][];

    if (entries.length === 0) {
      errors.push(`Activity "${activity}" has no participants.`);
      continue;
    }

    const hasResponsible = entries.some(([, v]) => v === "R" || v === "A/R");
    const hasAccountable = entries.some(([, v]) => v === "A" || v === "A/R");

    if (!hasResponsible) {
      errors.push(`Activity "${activity}" has no Responsible (R) role.`);
    }
    if (!hasAccountable) {
      errors.push(`Activity "${activity}" has no Accountable (A) role.`);
    }

    // Warn if activity has only Consulted/Informed
    const activeRoles = entries.filter(([, v]) => v === "R" || v === "A" || v === "A/R");
    if (activeRoles.length === 0) {
      warnings.push(`Activity "${activity}" has only Consulted/Informed roles.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that all roles referenced in RACI exist in the given role set.
 */
export function validateRaciRoles(raci: RaciMatrix, validRoleIds: Set<string>): RaciValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [activity, roles] of Object.entries(raci.activities)) {
    for (const roleId of Object.keys(roles)) {
      if (!validRoleIds.has(roleId)) {
        errors.push(`RACI activity "${activity}" references unknown role "${roleId}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
