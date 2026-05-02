import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";
import { ORCHESTRATOR_COLOR, AGENT_PALETTE } from "../../src/engine/color-resolver.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "color-test",
    description: "test",
    targetDir: "/tmp/color-test",
    size: "small",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    ...overrides,
  };
}

describe("integration: agent colors flow into generated files", () => {
  it("opencode.json sets crimson on orchestrator and palette colors on others", () => {
    const config = baseConfig();
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const oc = result.files.find((f) => f.path === "opencode.json")!;
    const cfg = JSON.parse(oc.content);

    expect(cfg.agent.orchestrator.color).toBe(ORCHESTRATOR_COLOR);

    for (const [id, entry] of Object.entries<Record<string, unknown>>(cfg.agent)) {
      if (id === "orchestrator") continue;
      const color = entry.color as string;
      expect(color).toBeDefined();
      // Either an explicit hex (palette or YAML override) or a theme key
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
      // Must not be the orchestrator's color (palette excludes it)
      expect(color).not.toBe(ORCHESTRATOR_COLOR);
    }
  });

  it("agent .md frontmatter includes quoted color line for every agent", () => {
    const config = baseConfig({ size: "medium" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const agentMds = result.files.filter((f) => f.path.startsWith(".opencode/agents/"));
    expect(agentMds.length).toBeGreaterThan(0);
    for (const md of agentMds) {
      // Hex must be quoted (sst/opencode#17118)
      expect(md.content).toMatch(/^color: "(#[0-9a-fA-F]{6}|primary|secondary|accent|success|warning|error|info)"$/m);
    }
  });

  it("orchestrator .md frontmatter has color: \"#dc143c\"", () => {
    const config = baseConfig();
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orchMd = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orchMd).toBeDefined();
    expect(orchMd!.content).toMatch(/^color: "#dc143c"$/m);
  });

  it("color resolution is deterministic across regenerations", () => {
    const config = baseConfig({ size: "medium" });
    const selection = runSelection(config, ctx);
    const r1 = runPipeline(config, selection, ctx);
    const r2 = runPipeline(config, selection, ctx);
    const cfg1 = JSON.parse(r1.files.find((f) => f.path === "opencode.json")!.content);
    const cfg2 = JSON.parse(r2.files.find((f) => f.path === "opencode.json")!.content);
    for (const id of Object.keys(cfg1.agent)) {
      expect(cfg2.agent[id].color).toBe(cfg1.agent[id].color);
    }
  });

  it("palette has at least 20 entries (cover the 20 baseline roles)", () => {
    expect(AGENT_PALETTE.length).toBeGreaterThanOrEqual(20);
  });
});
