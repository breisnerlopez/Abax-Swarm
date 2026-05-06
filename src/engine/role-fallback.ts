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
