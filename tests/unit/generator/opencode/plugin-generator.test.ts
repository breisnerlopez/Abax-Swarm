import { describe, it, expect } from "vitest";
import {
  generatePluginFiles,
  mergeTaskContracts,
  mergeSecretPatterns,
  mergeRunawayLimits,
  PLUGIN_OPENCODE_PATH,
} from "../../../../src/generator/opencode/plugin-generator.js";
import type {
  Role,
  TaskContracts,
  SecretPatterns,
  RunawayLimits,
} from "../../../../src/loader/schemas.js";
import type { ProjectConfig } from "../../../../src/engine/types.js";

// ---- Fixtures (minimal — generic over any team composition) ----

function makeRole(id: string, category: Role["category"]): Role {
  return {
    id,
    name: id,
    category,
    tier: "1",
    size_classification: { small: "indispensable", medium: "indispensable", large: "indispensable" },
    agent: {
      mode: "subagent",
      temperature: 0.3,
      description: "x".repeat(20),
      system_prompt: "y".repeat(60),
      permissions: {},
      tools_enabled: {},
      cognitive_tier: "implementation",
      reasoning: "low",
    },
    skills: [],
    tools: [],
    stack_overrides: {},
    dependencies: { receives_from: [], delivers_to: [] },
    phases: [],
    raci: {},
  };
}

const baselineTaskContracts: TaskContracts = {
  atomic_actions: [
    { id: "test", keywords: ["test"] },
    { id: "commit", keywords: ["commit"] },
  ],
  forbidden_combinations: [
    { id: "fix-and-ship", actions: ["test", "commit"], reason: "split into 2 tasks ".repeat(3) },
  ],
  exemptions: [],
};

const baselineSecretPatterns: SecretPatterns = {
  patterns: [
    { id: "openai-key", regex: "sk-[A-Za-z0-9]{20,}", severity: "block", description: "OpenAI" },
    { id: "jwt", regex: "eyJ[A-Za-z0-9_-]+", severity: "warn", description: "JWT" },
  ],
};

const baselineRunaway: RunawayLimits = {
  default: { parts_max: 300, duration_min_max: 30 },
  by_category: { construction: { parts_max: 500 } },
  by_role: {},
};

const minimalConfig: ProjectConfig = {
  name: "Demo",
  description: "demo",
  targetDir: "/tmp/demo",
  size: "small",
  criteria: [],
  stackId: "legacy-other",
  target: "opencode",
  teamScope: "lean",
};

// ---- Merge logic ----

describe("mergeTaskContracts", () => {
  it("returns baseline as-is when overlay is undefined", () => {
    expect(mergeTaskContracts(baselineTaskContracts, undefined)).toBe(baselineTaskContracts);
  });

  it("adds new ids and replaces same-id entries", () => {
    const overlay = {
      forbidden_combinations: [
        // same id → replace
        { id: "fix-and-ship", actions: ["test", "commit", "push"], reason: "stricter rule ".repeat(3) },
        // new id → add
        { id: "deploy-and-validate", actions: ["deploy", "test"], reason: "split deploy from validate ".repeat(2) },
      ],
    };
    const merged = mergeTaskContracts(baselineTaskContracts, overlay);
    expect(merged.forbidden_combinations).toHaveLength(2);
    expect(merged.forbidden_combinations.find((c) => c.id === "fix-and-ship")?.actions).toEqual([
      "test", "commit", "push",
    ]);
    expect(merged.forbidden_combinations.find((c) => c.id === "deploy-and-validate")).toBeDefined();
  });

  it("preserves baseline atomic_actions when overlay omits the field", () => {
    const merged = mergeTaskContracts(baselineTaskContracts, { forbidden_combinations: [] });
    expect(merged.atomic_actions).toEqual(baselineTaskContracts.atomic_actions);
  });
});

describe("mergeSecretPatterns", () => {
  it("returns baseline when extras is undefined or empty", () => {
    expect(mergeSecretPatterns(baselineSecretPatterns, undefined)).toBe(baselineSecretPatterns);
    expect(mergeSecretPatterns(baselineSecretPatterns, [])).toBe(baselineSecretPatterns);
  });

  it("appends new ids and replaces same-id entries", () => {
    const merged = mergeSecretPatterns(baselineSecretPatterns, [
      { id: "internal-token", regex: "tok_[A-Z]{10}", severity: "block", description: "internal" },
      { id: "openai-key", regex: "sk-proj-X", severity: "warn", description: "softer" }, // replace
    ]);
    expect(merged.patterns).toHaveLength(3); // openai-key, jwt, internal-token
    expect(merged.patterns.find((p) => p.id === "openai-key")?.severity).toBe("warn");
    expect(merged.patterns.find((p) => p.id === "internal-token")).toBeDefined();
  });
});

describe("mergeRunawayLimits", () => {
  it("returns baseline when overlay is undefined", () => {
    expect(mergeRunawayLimits(baselineRunaway, undefined)).toBe(baselineRunaway);
  });

  it("merges default field-by-field (overlay wins per field)", () => {
    const merged = mergeRunawayLimits(baselineRunaway, {
      default: { parts_max: 200 }, // duration_min_max preserved from baseline
    });
    expect(merged.default.parts_max).toBe(200);
    expect(merged.default.duration_min_max).toBe(30);
  });

  it("by_category and by_role overlay keys replace baseline keys", () => {
    const merged = mergeRunawayLimits(baselineRunaway, {
      by_category: { construction: { parts_max: 700 } }, // replace
      by_role: { "qa-functional": { parts_max: 250 } }, // add
    });
    expect(merged.by_category.construction).toEqual({ parts_max: 700 });
    expect(merged.by_role["qa-functional"]).toEqual({ parts_max: 250 });
  });
});

// ---- End-to-end generator output ----

describe("generatePluginFiles", () => {
  it("emits exactly two files at the documented opencode paths", () => {
    const files = generatePluginFiles(
      minimalConfig,
      [makeRole("developer-backend", "construction")],
      baselineTaskContracts,
      baselineSecretPatterns,
      baselineRunaway,
    );
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      ".opencode/plugins/abax-policy.ts",
      ".opencode/policies/abax-policies.json",
    ]);
    expect(PLUGIN_OPENCODE_PATH).toBe(".opencode/plugins/abax-policy.ts");
  });

  it("plugin .ts file is non-empty TypeScript (read from template)", () => {
    const files = generatePluginFiles(
      minimalConfig, [], baselineTaskContracts, baselineSecretPatterns, baselineRunaway,
    );
    const plugin = files.find((f) => f.path.endsWith("abax-policy.ts"))!;
    expect(plugin.content.length).toBeGreaterThan(500);
    expect(plugin.content).toContain("import type { Plugin }");
    expect(plugin.content).toContain("tool.execute.before");
  });

  it("policies JSON includes baseline + role_categories from team", () => {
    const files = generatePluginFiles(
      minimalConfig,
      [
        makeRole("developer-backend", "construction"),
        makeRole("qa-functional", "quality"),
      ],
      baselineTaskContracts,
      baselineSecretPatterns,
      baselineRunaway,
    );
    const policies = JSON.parse(
      files.find((f) => f.path.endsWith("abax-policies.json"))!.content,
    );
    expect(policies.task_contracts.atomic_actions).toEqual(baselineTaskContracts.atomic_actions);
    expect(policies.secret_patterns.patterns).toHaveLength(2);
    expect(policies.role_categories).toEqual({
      "developer-backend": "construction",
      "qa-functional": "quality",
    });
  });

  it("policies JSON applies project overlays (merge by id)", () => {
    const config: ProjectConfig = {
      ...minimalConfig,
      taskContractsOverride: {
        forbidden_combinations: [
          { id: "fix-and-ship", actions: ["test", "commit", "push"], reason: "stricter ".repeat(5) },
        ],
      },
      runawayLimitsOverride: {
        by_role: { "developer-backend": { parts_max: 700 } },
      },
    };
    const files = generatePluginFiles(
      config,
      [makeRole("developer-backend", "construction")],
      baselineTaskContracts, baselineSecretPatterns, baselineRunaway,
    );
    const policies = JSON.parse(
      files.find((f) => f.path.endsWith("abax-policies.json"))!.content,
    );
    expect(policies.task_contracts.forbidden_combinations[0].actions).toEqual(["test", "commit", "push"]);
    expect(policies.runaway_limits.by_role["developer-backend"]).toEqual({ parts_max: 700 });
  });
});
