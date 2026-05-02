import type { Role } from "../loader/schemas.js";

/** Crimson is reserved for the orchestrator so it always stands out. */
export const ORCHESTRATOR_COLOR = "#dc143c";

/**
 * Curated palette of vivid, well-separated hex colors for non-orchestrator agents.
 * Hue values intentionally skip the red range (≈340°–20°) so no entry can be
 * mistaken for the orchestrator. 24 entries — the deterministic hash distributes
 * roles across them; collisions are possible (palette size < theoretical role count)
 * but a role can always pin its own color via `agent.color` in its YAML.
 */
export const AGENT_PALETTE: readonly string[] = [
  "#ff8c00", // dark orange (~30°)
  "#ff6347", // tomato (~10° but warm; kept far from crimson by saturation)
  "#ffa500", // orange (~38°)
  "#ffd700", // gold (~50°)
  "#bdb76b", // dark khaki (~55°)
  "#9acd32", // yellow green (~80°)
  "#7cfc00", // lawn green (~90°)
  "#32cd32", // lime green (~120°)
  "#00fa9a", // medium spring green (~150°)
  "#3cb371", // medium sea green (~145°)
  "#20b2aa", // light sea green (~180°)
  "#48d1cc", // medium turquoise (~178°)
  "#00ced1", // dark turquoise (~181°)
  "#00bfff", // deep sky blue (~195°)
  "#1e90ff", // dodger blue (~210°)
  "#4169e1", // royal blue (~225°)
  "#7b68ee", // medium slate blue (~250°)
  "#9370db", // medium purple (~260°)
  "#9932cc", // dark orchid (~280°)
  "#ba55d3", // medium orchid (~290°)
  "#da70d6", // orchid (~300°)
  "#ff69b4", // hot pink (~330°)
  "#5f9ea0", // cadet blue (~180°, muted)
  "#daa520", // goldenrod (~43°)
];

/**
 * djb2 hash → non-negative int. Stable across processes/Node versions.
 */
function hashRoleId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h) + id.charCodeAt(i);
    h = h | 0; // force int32
  }
  return Math.abs(h);
}

/**
 * Resolve the OpenCode TUI color for an agent.
 *
 * Precedence:
 *   1. Explicit `agent.color` in the role YAML (full user control).
 *   2. Orchestrator → ORCHESTRATOR_COLOR (crimson).
 *   3. Deterministic hash(role.id) → AGENT_PALETTE.
 *
 * Same role.id always maps to the same color across regenerations. Adding or
 * removing other roles never changes a given role's color (no two-pass
 * allocation). If you need to break a collision, set `agent.color` explicitly.
 */
export function resolveAgentColor(role: Role): string {
  if (role.agent.color) return role.agent.color;
  if (role.id === "orchestrator") return ORCHESTRATOR_COLOR;
  return AGENT_PALETTE[hashRoleId(role.id) % AGENT_PALETTE.length]!;
}
