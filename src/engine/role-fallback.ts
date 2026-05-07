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

export interface ResolveOptions {
  /** Role ids to skip even if present in the team. Used to prevent
   * self-approval: when resolving an approver fallback, pass the
   * deliverable's resolved responsible so the chain skips the same
   * person. Generic — caller chooses the exclusion semantics. */
  exclude?: ReadonlySet<string> | readonly string[];
}

/**
 * Resolve a role reference with fallback chain. Returns the first role
 * id that is present in the team AND not excluded. If none match,
 * returns null — the caller decides what to do (typically silent drop
 * for `responsible`, "el usuario (sponsor)" string substitution for
 * gate_approver).
 *
 * The exclude option lets callers enforce segregation of duties: for
 * approvers, pass the responsible's resolved id to prevent the chain
 * from picking the same person to approve their own work. The check
 * applies to BOTH the primary and fallback candidates — if the primary
 * is excluded, the chain is consulted as if the primary weren't in
 * the team.
 */
export function resolveWithFallback(
  primary: string,
  fallbackChain: readonly string[] | undefined,
  teamIds: ReadonlySet<string>,
  options?: ResolveOptions,
): string | null {
  const excluded = toSet(options?.exclude);
  if (teamIds.has(primary) && !excluded.has(primary)) return primary;
  if (!fallbackChain) return null;
  for (const candidate of fallbackChain) {
    if (teamIds.has(candidate) && !excluded.has(candidate)) return candidate;
  }
  return null;
}

function toSet(v: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  if (!v) return EMPTY;
  if (v instanceof Set) return v;
  return new Set(v as readonly string[]);
}
const EMPTY: ReadonlySet<string> = new Set<string>();

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
        // Approver resolution excludes the resolved responsible so a
        // long fallback chain doesn't accidentally land on the same
        // person — segregation of duties at the data layer.
        const resolvedApp = resolveWithFallback(
          d.approver,
          d.approver_fallback,
          teamIds,
          { exclude: [resolvedResp] },
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
