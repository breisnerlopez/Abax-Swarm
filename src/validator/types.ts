/**
 * Shared types and helpers for the validator stack.
 *
 * Notices vs warnings split (introduced in 0.1.41):
 *
 *   - **errors**: hard inconsistencies that should usually block. Emitted
 *     by orchestrator validator (missing sections, undeclared @mentions).
 *   - **warnings**: actionable issues the user can fix. Emitted when a
 *     role reference cannot be resolved AND the role is in the
 *     "indispensable"/"recommended" tier for the project size, OR the
 *     size context is unavailable.
 *   - **notices**: informational confirmations that the system worked
 *     around a gap (fallback resolved successfully) OR the missing
 *     reference is for a role the user knew was optional. Default UX
 *     hides notices unless verbose.
 *
 * Generic across all validators — context is optional so existing
 * callers without project size info still work (warnings are emitted
 * with full verbosity in that case).
 */

import type { SizeMatrix, ProjectSize } from "../loader/schemas.js";

export interface ValidationContext {
  /** Pass `ctx.sizeMatrix` from DataContext to enable governance-aware
   * downgrading of warnings about optional roles. */
  sizeMatrix?: SizeMatrix;
  /** Project size selected by the user. */
  projectSize?: ProjectSize;
  /** Project mode. In `"document"` mode the user picked a docs-only
   * team intentionally; references to dev/qa/ops roles in RACI or
   * phase deliverables are NOT actionable findings, so they're all
   * downgraded to notices regardless of the role's tier in the size
   * matrix. */
  mode?: "new" | "document" | "continue";
}

/** Where a role sits in the size matrix tiers. `unknown` when the
 * context is missing or the role isn't catalogued. */
export type RoleTier = "indispensable" | "recommended" | "optional" | "unknown";

/**
 * Look up a role's tier for the project's size. Returns "unknown" when
 * size matrix or project size is unavailable — caller treats that as
 * "show full warning verbosity" (the safe default).
 */
export function classifyRoleTier(roleId: string, ctx: ValidationContext | undefined): RoleTier {
  if (!ctx?.sizeMatrix || !ctx?.projectSize) return "unknown";
  const sizeData = ctx.sizeMatrix.roles_by_size[ctx.projectSize];
  if (!sizeData) return "unknown";
  if (sizeData.indispensable.includes(roleId)) return "indispensable";
  if (sizeData.recommended.includes(roleId)) return "recommended";
  if (sizeData.optional.includes(roleId)) return "optional";
  return "unknown";
}

/**
 * Decide whether a "missing role" condition should be a warning or a
 * notice given the role's tier in the project size matrix and the
 * project mode.
 *
 *  - mode === "document" → ALWAYS notice (the user picked a docs-only
 *    team intentionally; dev/qa/ops references in catalogue data are
 *    not actionable in this mode)
 *  - `optional` for this size → notice (the user knew it was skippable)
 *  - `recommended` / `indispensable` / `unknown` → warning (user
 *    probably wanted that role; absence is surprising)
 */
export function severityForMissingRole(
  roleId: string,
  ctx: ValidationContext | undefined,
): "warning" | "notice" {
  if (ctx?.mode === "document") return "notice";
  return classifyRoleTier(roleId, ctx) === "optional" ? "notice" : "warning";
}

/**
 * Common shape returned by all three validators. Callers aggregate
 * `notices` and `warnings` into separate channels so the CLI can
 * collapse one and surface the other.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Informational messages — fallback applied successfully OR the
   * missing role was optional for this project size. Hidden by default
   * in CLI output; surfaced via `abax-swarm validate --verbose`. */
  notices: string[];
}
