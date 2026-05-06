import type { PhaseDeliverables } from "../loader/schemas.js";
import { resolveWithFallback } from "../engine/role-fallback.js";

export interface GatesValidationResult {
  valid: boolean;
  /** Hard inconsistencies (e.g. malformed gate). Currently always empty —
   * Zod catches structural issues at load time. Reserved for future
   * deliverable/gate cross-reference checks. */
  errors: string[];
  /** Soft notices: a gate or deliverable references a role not present in
   * the current team. Caller decides whether to surface or ignore. */
  warnings: string[];
}

/**
 * Cross-checks every role reference in `phase-deliverables.yaml` (gates +
 * deliverables) against the actual team. Mirrors `validateRaciRoles()` for
 * RACI but for the phase model. Designed to be invoked AFTER role
 * selection is final, so `validRoleIds` reflects the resolved team.
 *
 * Behaviour: never blocks — emits one warning per dangling reference. The
 * pipeline already FILTERS dangling deliverables silently in
 * orchestrator-generator (see `buildPhaseGates()`), so this validator's
 * job is purely to give the user visibility into what's being skipped.
 *
 * Generic across role compositions: the validator does not assume any
 * particular role exists. A small team triggers many warnings, a large
 * team few. That is by design.
 */
export function validateGatesAgainstTeam(
  phaseDeliverables: PhaseDeliverables,
  validRoleIds: Set<string>,
): GatesValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const phase of phaseDeliverables.phases) {
    // 1. gate_approver references the team
    if (!validRoleIds.has(phase.gate_approver)) {
      warnings.push(
        `Phase "${phase.id}": gate_approver "${phase.gate_approver}" is not in the team. ` +
          `Generator falls back to "the user (sponsor)". Consider including the role or adjusting phase-deliverables.yaml.`,
      );
    }

    // 2. each deliverable's responsible/approver
    //    Optional deliverables (mandatory: false) being absent is expected
    //    behaviour — the orchestrator-generator filters them. We only warn
    //    for `mandatory: true` deliverables because losing those silently
    //    is the actual surprise we want to surface.
    //    When a fallback chain (responsible_fallback / approver_fallback)
    //    resolves the dangling reference, no warning is emitted — that is
    //    the system working as designed.
    for (const d of phase.deliverables) {
      if (!d.mandatory) continue;
      const resolvedResp = resolveWithFallback(d.responsible, d.responsible_fallback, validRoleIds);
      if (!resolvedResp) {
        warnings.push(
          `Phase "${phase.id}" / deliverable "${d.id}" (mandatory): responsible "${d.responsible}" not in team and no fallback role resolved (chain: [${(d.responsible_fallback ?? []).join(", ") || "none"}]). ` +
            `Deliverable will be silently filtered out by the orchestrator generator.`,
        );
      } else if (resolvedResp !== d.responsible) {
        // Informational notice only when fallback was triggered.
        warnings.push(
          `Phase "${phase.id}" / deliverable "${d.id}": primary responsible "${d.responsible}" not in team — fallback resolved to "${resolvedResp}".`,
        );
      }
      const resolvedApp = resolveWithFallback(d.approver, d.approver_fallback, validRoleIds);
      if (!resolvedApp) {
        warnings.push(
          `Phase "${phase.id}" / deliverable "${d.id}" (mandatory): approver "${d.approver}" not in team and no fallback role resolved. ` +
            `Deliverable may render but its approver line will be misleading.`,
        );
      }
    }

    // 3. gates with role references (only `attestation` gates today carry
    //    `attestor_role`; the discriminated union ensures other gate types
    //    don't have it)
    for (const g of phase.gates) {
      if (g.type === "attestation") {
        if (!validRoleIds.has(g.attestor_role)) {
          warnings.push(
            `Phase "${phase.id}" / gate "${g.id}": attestor_role "${g.attestor_role}" not in team. ` +
              `The gate cannot be satisfied as-is — either add the role or remove the gate for this team composition.`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Optional companion check: when running in document mode, gates declared
 * for non-document phases (construction, deployment, etc.) are silently
 * ignored because document mode replaces the phase set entirely. Surface
 * one notice per ignored phase so the user knows their gates are dormant
 * in this mode.
 */
export function validateGatesForDocumentMode(
  phaseDeliverables: PhaseDeliverables,
  documentPhaseIds: string[],
): GatesValidationResult {
  const documentSet = new Set(documentPhaseIds);
  const warnings: string[] = [];

  for (const phase of phaseDeliverables.phases) {
    if (phase.gates.length === 0) continue;
    if (!documentSet.has(phase.id)) {
      warnings.push(
        `Phase "${phase.id}" declares ${phase.gates.length} gate(s) but the project runs in document mode (phases: ${documentPhaseIds.join(", ")}). ` +
          `Those gates are not evaluated in this mode.`,
      );
    }
  }

  return { valid: true, errors: [], warnings };
}
