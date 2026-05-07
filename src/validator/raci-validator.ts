import type { RaciMatrix, RaciValue } from "../loader/schemas.js";
import {
  type ValidationContext,
  type ValidationResult,
  severityForMissingRole,
} from "./types.js";

export type RaciValidationResult = ValidationResult;

/**
 * Validates RACI matrix completeness:
 * - Every activity must have at least one R (Responsible)
 * - Every activity must have at least one A (Accountable) or A/R
 * - No activity should have zero participants
 */
export function validateRaciMatrix(raci: RaciMatrix): RaciValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notices: string[] = [];

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
    notices,
  };
}

/**
 * Validates that all roles referenced in RACI exist in the given role set.
 *
 * Severity (introduced in 0.1.41):
 *   - Role optional for project size → NOTICE (user knew it was skippable)
 *   - Role recommended/indispensable/unknown → WARNING
 *
 * Demoted from "errors" in 0.1.40 because RACI references roles that may
 * not be in the user's team — that is by design (the data file caters to
 * the full enterprise template). The activity still has other R/A roles
 * from the team; a missing reference just means one column is blank.
 */
export function validateRaciRoles(
  raci: RaciMatrix,
  validRoleIds: Set<string>,
  ctx?: ValidationContext,
): RaciValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notices: string[] = [];

  for (const [activity, roles] of Object.entries(raci.activities)) {
    for (const roleId of Object.keys(roles)) {
      if (!validRoleIds.has(roleId)) {
        const msg = `RACI activity "${activity}" references unknown role "${roleId}".`;
        if (severityForMissingRole(roleId, ctx) === "notice") {
          notices.push(msg);
        } else {
          warnings.push(msg);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    notices,
  };
}
