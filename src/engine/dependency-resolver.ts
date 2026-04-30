import type { DependencyGraph } from "../loader/schemas.js";
import type { RoleSelection, DependencyWarning } from "./types.js";

/**
 * Resolves hard dependencies transitively.
 * If role A has hard dep on B, and B is not in selections, B gets added.
 * Returns updated selections with dependency-added roles.
 */
export function resolveHardDependencies(
  selections: RoleSelection[],
  graph: DependencyGraph,
): RoleSelection[] {
  const result = [...selections];
  const selectedIds = new Set(result.map((s) => s.roleId));
  let changed = true;

  // Iterate until no more dependencies need adding
  while (changed) {
    changed = false;
    for (const selection of [...result]) {
      const deps = graph.dependencies[selection.roleId];
      if (!deps) continue;

      for (const hardDep of deps.hard) {
        if (!selectedIds.has(hardDep)) {
          result.push({
            roleId: hardDep,
            reason: "dependency",
            removable: false,
          });
          selectedIds.add(hardDep);
          changed = true;
        }
      }
    }
  }

  return result;
}

/**
 * Checks for missing soft dependencies and returns warnings.
 */
export function checkSoftDependencies(
  selections: RoleSelection[],
  graph: DependencyGraph,
): DependencyWarning[] {
  const selectedIds = new Set(selections.map((s) => s.roleId));
  const warnings: DependencyWarning[] = [];

  for (const selection of selections) {
    const deps = graph.dependencies[selection.roleId];
    if (!deps) continue;

    for (const softDep of deps.soft) {
      if (!selectedIds.has(softDep)) {
        warnings.push({
          roleId: selection.roleId,
          missingDependency: softDep,
          type: "soft",
          message: `${selection.roleId} funciona mejor con ${softDep} (no incluido)`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Detects circular dependencies in the graph.
 * Returns list of cycles found (each cycle as array of role IDs).
 */
export function detectCircularDependencies(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): void {
    if (inStack.has(nodeId)) {
      // Found cycle: extract from path
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), nodeId]);
      }
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const deps = graph.dependencies[nodeId];
    if (deps) {
      // Only check hard dependencies for cycles (soft cycles are acceptable)
      for (const dep of deps.hard) {
        dfs(dep);
      }
    }

    path.pop();
    inStack.delete(nodeId);
  }

  for (const nodeId of Object.keys(graph.dependencies)) {
    dfs(nodeId);
  }

  return cycles;
}

/**
 * Full dependency resolution: resolve hard deps + check soft deps.
 */
export function resolveDependencies(
  selections: RoleSelection[],
  graph: DependencyGraph,
): { selections: RoleSelection[]; warnings: DependencyWarning[] } {
  const resolved = resolveHardDependencies(selections, graph);
  const warnings = checkSoftDependencies(resolved, graph);
  return { selections: resolved, warnings };
}
