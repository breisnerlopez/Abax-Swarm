// Shared test helpers — load DataContext + factories for ProjectConfig
// at common composition points. Centralized so cross-composition tests,
// differential tests, and semantic snapshot tests share the same fixtures
// and any data drift is caught uniformly.
import { loadAllRules } from "../../src/loader/rule-loader.js";
import { loadRolesAsMap } from "../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../src/loader/stack-loader.js";
import { runSelection, runPipeline, type PipelineResult } from "../../src/cli/pipeline.js";
import type {
  ProjectConfig,
  DataContext,
  TargetPlatform,
  ProjectMode,
} from "../../src/engine/types.js";
import type { ProjectSize } from "../../src/loader/schemas.js";

/** Load the full DataContext from /data — same as the CLI does at runtime. */
export function loadTestContext(): DataContext {
  return {
    roles: loadRolesAsMap("data/roles"),
    skills: loadSkillsAsMap("data/skills"),
    tools: loadToolsAsMap("data/tools"),
    stacks: loadStacksAsMap("data/stacks"),
    ...loadAllRules("data/rules"),
  } as DataContext;
}

export interface ConfigOverrides {
  size?: ProjectSize;
  stackId?: string;
  target?: TargetPlatform;
  mode?: ProjectMode;
  name?: string;
  teamScope?: "lean" | "full";
  isolationMode?: "host" | "devcontainer";
  targetDir?: string;
}

/**
 * Build a ProjectConfig with sensible defaults so callers only specify
 * the dimensions that matter for their test. Defaults pick the user's
 * reported scenario (small + lightweight + angular-quarkus + opencode +
 * new mode) so tests are anchored to a realistic composition.
 */
export function buildConfig(overrides: ConfigOverrides = {}): ProjectConfig {
  return {
    name: overrides.name ?? "test-project",
    description: "test composition",
    targetDir: overrides.targetDir ?? "/tmp/test-out",
    size: overrides.size ?? "small",
    stackId: overrides.stackId ?? "angular-quarkus",
    target: overrides.target ?? "opencode",
    teamScope: overrides.teamScope ?? "full",
    criteria: [],
    provider: "anthropic",
    modelStrategy: "inherit",
    permissionMode: "recommended",
    isolationMode: overrides.isolationMode ?? "host",
    mode: overrides.mode,
  } as ProjectConfig;
}

/** Run the full pipeline for a composition — selection + generation. */
export function generate(config: ProjectConfig, ctx: DataContext = loadTestContext()): PipelineResult {
  const selection = runSelection(config, ctx);
  return runPipeline(config, selection, ctx);
}

/**
 * Generate a small but representative matrix of compositions for
 * cross-composition tests. Not the full 36 from the e2e sweep — that
 * runs as a shell script. This is the in-process subset that vitest can
 * iterate over quickly.
 */
export function buildCompositionMatrix(): Array<{ id: string; config: ProjectConfig }> {
  const sizes: ProjectSize[] = ["small", "medium", "large"];
  const stacks = ["angular-quarkus", "react-nextjs", "python-fastapi", "go-fiber"];
  const targets: TargetPlatform[] = ["opencode", "claude"];
  const matrix: Array<{ id: string; config: ProjectConfig }> = [];
  for (const size of sizes) {
    for (const stack of stacks) {
      for (const target of targets) {
        matrix.push({
          id: `${size}-${stack}-${target}`,
          config: buildConfig({ size, stackId: stack, target }),
        });
      }
    }
  }
  return matrix;
}

/**
 * Strip non-deterministic fields from generated content so two
 * generations of the same config compare equal. Currently: generated_at
 * timestamp in YAML/JSON.
 */
export function stripNonDeterministic(content: string): string {
  return content
    .replace(/^generated_at:.*$/m, "generated_at: <stripped>")
    .replace(/"generated_at"\s*:\s*"[^"]*"/g, '"generated_at":"<stripped>"');
}

/**
 * Normalize a policies.json for cross-target comparison. opencode and
 * claude emit slightly different paths (.opencode/ vs .claude/) but the
 * semantic content (phases, deliverables, role categories) should be
 * identical. Strips target-specific fields.
 */
export function normalizeForCrossTarget(policies: unknown): unknown {
  if (!policies || typeof policies !== "object") return policies;
  const json = JSON.parse(JSON.stringify(policies));
  // Walk and strip target-specific paths if any (currently none in
  // policies.json — kept as a hook for future refactors).
  return json;
}

/**
 * Extract the section of an orchestrator.md for a specific deliverable
 * id. Returns the slice of text from the deliverable's heading to the
 * next heading (or end-of-file). Used by semantic snapshot tests to
 * verify content per-deliverable without coupling to global structure.
 */
export function extractDeliverableSection(orchestratorMd: string, idOrName: string): string {
  // Deliverables in the orchestrator may appear by id (in code-like
  // contexts, paths) or by human name (in prose tables). Search both.
  const idx = orchestratorMd.indexOf(idOrName);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 100);
  const end = Math.min(orchestratorMd.length, idx + 500);
  return orchestratorMd.slice(start, end);
}

/**
 * Look up the human name (UI label) of a deliverable from policies.json.
 * Used by semantic snapshot tests so they can search by either id or
 * name interchangeably without coupling to which one the orchestrator
 * happens to render.
 */
export function deliverableName(
  policies: { phases: Array<{ deliverables: Array<{ id: string; name: string }> }> },
  deliverableId: string,
): string | null {
  for (const phase of policies.phases) {
    for (const d of phase.deliverables) {
      if (d.id === deliverableId) return d.name;
    }
  }
  return null;
}

/**
 * Extract structural shape of a JSON object: keys at each level, array
 * lengths replaced by structural placeholder. Used to assert two
 * different generations have the SAME shape regardless of contents.
 */
export function extractShape(obj: unknown, depth = 0): unknown {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [];
    // Keep one representative element shape — assumes arrays are
    // homogeneous (true for our policies.json structure).
    return [extractShape(obj[0], depth + 1)];
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const shape: Record<string, unknown> = {};
    for (const k of keys) {
      shape[k] = extractShape((obj as Record<string, unknown>)[k], depth + 1);
    }
    return shape;
  }
  return typeof obj;
}
