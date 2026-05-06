/**
 * Role fallback resolver — single source of truth for the
 * `responsible_fallback` / `approver_fallback` chains declared in
 * data/rules/phase-deliverables.yaml.
 *
 * Used by:
 *   - orchestrator-generator (opencode + claude): pick the @mention
 *     in deliverable rendering
 *   - plugin-generator: rewrite policies.phases[].deliverables[].responsible
 *     so the runtime tools (phase-state, attest-deliverable,
 *     verify-deliverable) see the team-resolvable role
 *   - validators (gates-validator): suppress warnings when a fallback
 *     resolves the dangling reference
 *
 * Generic across team compositions — the fallback chains are declared
 * per-deliverable in the data layer, this file is pure mechanism.
 */

/**
 * Resolve a role reference with fallback chain. Returns the first role
 * id that is present in the team. If none match, returns null — the
 * caller decides what to do (typically silent drop for `responsible`,
 * "el usuario (sponsor)" string substitution for gate_approver).
 */
export function resolveWithFallback(
  primary: string,
  fallbackChain: readonly string[] | undefined,
  teamIds: ReadonlySet<string>,
): string | null {
  if (teamIds.has(primary)) return primary;
  if (!fallbackChain) return null;
  for (const candidate of fallbackChain) {
    if (teamIds.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Convenience: resolve OR return the primary unchanged (for cases
 * where downstream silently fails-open on absent roles).
 */
export function resolveWithFallbackOrPrimary(
  primary: string,
  fallbackChain: readonly string[] | undefined,
  teamIds: ReadonlySet<string>,
): string {
  return resolveWithFallback(primary, fallbackChain, teamIds) ?? primary;
}

/**
 * Phase deliverable shape — minimal subset needed for resolution.
 * Both opencode plugin-generator and claude policy-generator import
 * this helper to keep `policies.phases` consistent across targets.
 */
interface ResolvableDeliverable {
  id: string;
  responsible: string;
  approver: string;
  mandatory: boolean;
  responsible_fallback: string[];
  approver_fallback: string[];
  [k: string]: unknown;
}
interface ResolvablePhase {
  id: string;
  deliverables: ResolvableDeliverable[];
  [k: string]: unknown;
}

/**
 * Resolve all `responsible` AND `approver` references in a phase set
 * against the given team. Drops deliverables whose responsible cannot
 * be resolved (they couldn't be delegated). Used by BOTH
 * `opencode/plugin-generator.ts` and `claude/policy-generator.ts` so
 * the runtime view is identical regardless of target.
 *
 * Returns a NEW phase array; inputs are not mutated.
 */
export function resolveDeliverablesForTeam<P extends ResolvablePhase>(
  phases: readonly P[],
  teamIds: ReadonlySet<string>,
): P[] {
  return phases.map((p) => {
    const filtered = p.deliverables
      .map((d) => {
        const resolvedResp = resolveWithFallback(
          d.responsible,
          d.responsible_fallback,
          teamIds,
        );
        if (!resolvedResp) return null;
        const resolvedApp = resolveWithFallback(
          d.approver,
          d.approver_fallback,
          teamIds,
        );
        return {
          ...d,
          responsible: resolvedResp,
          approver: resolvedApp ?? d.approver,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return { ...p, deliverables: filtered };
  });
}
