import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "glossary-test",
    description: "test",
    targetDir: "/tmp/glossary-test",
    size: "medium",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    ...overrides,
  };
}

const GLOSSARY_MARKERS = [
  /## Glosario/,                        // section header text used in the rule
  /3 o mas acronimos/,                  // threshold phrasing
  /Maximo 7 terminos/,                  // upper bound
];

describe("integration: glossary rule emitted into agent files", () => {
  it("every opencode agent (except orchestrator) carries the glossary rule", () => {
    const config = baseConfig({ target: "opencode" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const agents = result.files.filter(
      (f) => f.path.startsWith(".opencode/agents/") && f.path !== ".opencode/agents/orchestrator.md",
    );
    expect(agents.length).toBeGreaterThan(0);
    for (const md of agents) {
      for (const marker of GLOSSARY_MARKERS) {
        expect(md.content, `${md.path} missing marker ${marker}`).toMatch(marker);
      }
    }
  });

  it("orchestrator file does NOT carry the glossary rule (it does not write deliverables)", () => {
    const config = baseConfig({ target: "opencode" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md");
    expect(orch).toBeDefined();
    expect(orch!.content).not.toMatch(/## Glosario/);
  });

  it("every claude agent (except orchestrator) carries the glossary rule", () => {
    const config = baseConfig({ target: "claude" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const agents = result.files.filter(
      (f) => f.path.startsWith(".claude/agents/") && f.path !== ".claude/agents/orchestrator.md",
    );
    expect(agents.length).toBeGreaterThan(0);
    for (const md of agents) {
      for (const marker of GLOSSARY_MARKERS) {
        expect(md.content, `${md.path} missing marker ${marker}`).toMatch(marker);
      }
    }
  });
});
