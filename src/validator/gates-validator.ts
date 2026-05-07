import type { PhaseDeliverables } from "../loader/schemas.js";
import { resolveWithFallback } from "../engine/role-fallback.js";
import {
  type ValidationContext,
  type ValidationResult,
  severityForMissingRole,
} from "./types.js";

export type GatesValidationResult = ValidationResult;

/**
 * Cross-checks every role reference in `phase-deliverables.yaml` (gates +
 * deliverables) against the actual team. Mirrors `validateRaciRoles()` for
 * RACI but for the phase model. Designed to be invoked AFTER role
 * selection is final, so `validRoleIds` reflects the resolved team.
 *
 * Severity (introduced in 0.1.41):
 *   - "fallback resolved to X" → always a NOTICE (system worked)
 *   - "no fallback resolved" + role optional for project size → NOTICE
 *     (user knew the role was skippable)
 *   - "no fallback resolved" + role recommended/indispensable/unknown →
 *     WARNING (the deliverable will render with a misleading approver
 *     line OR will be silently filtered by the orchestrator generator)
 *
 * Behaviour: never blocks — emits at most one message per dangling
 * reference. The pipeline already FILTERS dangling deliverables silently
 * in orchestrator-generator (see `buildPhaseGates()`), so this
 * validator's job is purely to give the user visibility into what is
 * being skipped + classify each finding by severity so the CLI can
 * surface the actionable ones and collapse the rest.
 *
 * Generic across role compositions and governance models: more roles =
 * fewer findings, smaller team + lightweight governance = more notices
 * (none of which the user needs to act on).
 */
export function validateGatesAgainstTeam(
  phaseDeliverables: PhaseDeliverables,
  validRoleIds: Set<string>,
  ctx?: ValidationContext,
): GatesValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notices: string[] = [];

  const push = (msg: string, severity: "warning" | "notice") => {
    if (severity === "notice") notices.push(msg);
    else warnings.push(msg);
  };

  for (const phase of phaseDeliverables.phases) {
    // 1. gate_approver references the team
    if (!validRoleIds.has(phase.gate_approver)) {
      push(
        `Phase "${phase.id}": gate_approver "${phase.gate_approver}" is not in the team. ` +
          `Generator falls back to "the user (sponsor)". Consider including the role or adjusting phase-deliverables.yaml.`,
        severityForMissingRole(phase.gate_approver, ctx),
      );
    }

    // 2. each deliverable's responsible/approver
    for (const d of phase.deliverables) {
      if (!d.mandatory) continue;
      const resolvedResp = resolveWithFallback(d.responsible, d.responsible_fallback, validRoleIds);
      if (!resolvedResp) {
        push(
          `Phase "${phase.id}" / deliverable "${d.id}" (mandatory): responsible "${d.responsible}" not in team and no fallback role resolved (chain: [${(d.responsible_fallback ?? []).join(", ") || "none"}]). ` +
            `Deliverable will be silently filtered out by the orchestrator generator.`,
          severityForMissingRole(d.responsible, ctx),
        );
      } else if (resolvedResp !== d.responsible) {
        // Fallback succeeded — informational only.
        notices.push(
          `Phase "${phase.id}" / deliverable "${d.id}": primary responsible "${d.responsible}" not in team — fallback resolved to "${resolvedResp}".`,
        );
      }
      // Approver resolution excludes the resolved responsible (segregation
      // of duties at the data layer, courtesy of resolveWithFallback's
      // `exclude` option).
      const resolvedApp = resolveWithFallback(
        d.approver,
        d.approver_fallback,
        validRoleIds,
        resolvedResp ? { exclude: [resolvedResp] } : undefined,
      );
      if (!resolvedApp) {
        push(
          `Phase "${phase.id}" / deliverable "${d.id}" (mandatory): approver "${d.approver}" not in team and no fallback role resolved (chain: [${(d.approver_fallback ?? []).join(", ") || "none"}]). ` +
            `Deliverable may render but its approver line will be misleading.`,
          severityForMissingRole(d.approver, ctx),
        );
      } else if (resolvedApp !== d.approver) {
        // Fallback succeeded — informational only.
        notices.push(
          `Phase "${phase.id}" / deliverable "${d.id}": primary approver "${d.approver}" not in team — fallback resolved to "${resolvedApp}".`,
        );
      }
    }

    // 3. gates with role references (only `attestation` gates today carry
    //    `attestor_role`; the discriminated union ensures other gate types
    //    don't have it)
    for (const g of phase.gates) {
      if (g.type === "attestation") {
        if (!validRoleIds.has(g.attestor_role)) {
          push(
            `Phase "${phase.id}" / gate "${g.id}": attestor_role "${g.attestor_role}" not in team. ` +
              `The gate cannot be satisfied as-is — either add the role or remove the gate for this team composition.`,
            severityForMissingRole(g.attestor_role, ctx),
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, notices };
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
  const notices: string[] = [];

  for (const phase of phaseDeliverables.phases) {
    if (phase.gates.length === 0) continue;
    if (!documentSet.has(phase.id)) {
      notices.push(
        `Phase "${phase.id}" declares ${phase.gates.length} gate(s) but the project runs in document mode (phases: ${documentPhaseIds.join(", ")}). ` +
          `Those gates are not evaluated in this mode.`,
      );
    }
  }

  return { valid: true, errors: [], warnings: [], notices };
}
