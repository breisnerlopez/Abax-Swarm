import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "model-mix-test",
    description: "test",
    targetDir: "/tmp/model-mix-test",
    size: "small",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    ...overrides,
  };
}

describe("integration: model mix flows into generated files", () => {
  it("opencode.json contains model + thinking for anthropic", () => {
    const config = baseConfig({ provider: "anthropic" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const oc = result.files.find((f) => f.path === "opencode.json")!;
    const cfg = JSON.parse(oc.content);

    // Orchestrator is strategic+high → opus + thinking 32k
    expect(cfg.agent.orchestrator.model).toContain("opus");
    expect(cfg.agent.orchestrator.thinking).toEqual({ type: "enabled", budgetTokens: 32000 });

    // developer-backend is implementation+low → sonnet + thinking 4k
    if (cfg.agent["developer-backend"]) {
      expect(cfg.agent["developer-backend"].model).toContain("sonnet");
      expect(cfg.agent["developer-backend"].thinking?.budgetTokens).toBe(4000);
    }

    // tech-writer is mechanical+none → haiku, no thinking
    if (cfg.agent["tech-writer"]) {
      expect(cfg.agent["tech-writer"].model).toContain("haiku");
      expect(cfg.agent["tech-writer"].thinking).toBeUndefined();
    }
  });

  it("opencode.json contains model + reasoningEffort for openai", () => {
    const config = baseConfig({ provider: "openai" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const oc = result.files.find((f) => f.path === "opencode.json")!;
    const cfg = JSON.parse(oc.content);

    expect(cfg.agent.orchestrator.model).toContain("gpt-5");
    expect(cfg.agent.orchestrator.reasoningEffort).toBe("high");
    expect(cfg.agent.orchestrator.thinking).toBeUndefined();
  });

  it("agent .md frontmatter contains model + thinking", () => {
    const config = baseConfig({ size: "medium", provider: "anthropic" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const devMd = result.files.find((f) => f.path === ".opencode/agents/developer-backend.md")!;
    expect(devMd.content).toContain("model: anthropic/claude-sonnet-4-6");
    expect(devMd.content).toContain("thinking:");
    expect(devMd.content).toContain("budgetTokens: 4000");
  });

  it("modelOverrides override the role's tier/reasoning", () => {
    const config = baseConfig({
      provider: "anthropic",
      modelOverrides: {
        "developer-backend": { cognitive_tier: "strategic", reasoning: "high" },
      },
    });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const oc = result.files.find((f) => f.path === "opencode.json")!;
    const cfg = JSON.parse(oc.content);

    if (cfg.agent["developer-backend"]) {
      // Overridden to strategic+high
      expect(cfg.agent["developer-backend"].model).toContain("opus");
      expect(cfg.agent["developer-backend"].thinking?.budgetTokens).toBe(32000);
    }
  });
});
