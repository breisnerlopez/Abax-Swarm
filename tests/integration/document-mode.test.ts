import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import { runSelection, runPipeline } from "../../src/cli/pipeline.js";
import type { DataContext, ProjectConfig } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

function docConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    name: "doc-test",
    description: "test",
    targetDir: "/tmp/doc-test",
    size: "small",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    mode: "document",
    ...overrides,
  };
}

describe("document mode: selection + pipeline", () => {
  it("selects the curated team from document-mode.yaml (not size-matrix)", () => {
    const config = docConfig();
    const selection = runSelection(config, ctx);
    const ids = selection.roles.map((r) => r.roleId).sort();
    expect(ids).toContain("tech-writer");
    expect(ids).toContain("business-analyst");
    expect(ids).toContain("solution-architect");
    expect(ids).toContain("dba");
    expect(ids).toContain("ux-designer");
    // small size in size-matrix would NOT include tech-writer; document mode must.
    expect(selection.governanceModel).toBe("documentation");
  });

  it("includes optional security-architect only when opted in via criteria field", () => {
    const without = runSelection(docConfig(), ctx);
    expect(without.roles.map((r) => r.roleId)).not.toContain("security-architect");

    const withSec = runSelection(docConfig({ criteria: ["security-architect"] }), ctx);
    expect(withSec.roles.map((r) => r.roleId)).toContain("security-architect");
  });

  it("folds reverse-engineering skill into the resolved set", () => {
    const config = docConfig();
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    expect(result.project.skills.some((s) => s.id === "reverse-engineering")).toBe(true);
  });

  it("emits MkDocs scaffold (mkdocs.yml + requirements.txt + docs/index.md)", () => {
    const config = docConfig();
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("mkdocs.yml");
    expect(paths).toContain("requirements.txt");
    expect(paths).toContain("docs/index.md");
    // Phase seeds
    expect(paths.some((p) => p === "docs/discovery/index.md")).toBe(true);
    expect(paths.some((p) => p === "docs/publication/index.md")).toBe(true);
  });

  it("does NOT emit MkDocs scaffold in modes other than document", () => {
    const config = docConfig({ mode: "new" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const paths = result.files.map((f) => f.path);
    expect(paths).not.toContain("mkdocs.yml");
  });
});

describe("orchestrator template: conditional sections", () => {
  it("includes the document-mode section when mode === 'document'", () => {
    const config = docConfig();
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Modo DOCUMENTACION");
    // The 5 phase ids should appear in the rendered phases list
    expect(orch.content).toContain("`discovery`");
    expect(orch.content).toContain("`documentation`");
    expect(orch.content).toContain("`publication`");
  });

  it("includes the per-phase commit block when hasGit is true (distributed flow since 0.1.16)", () => {
    const config = docConfig({ detection: { stackId: null, evidence: [], existingDocs: false, hasGit: true, hasDevcontainer: false } });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de commits por fase");
    expect(orch.content).toMatch(/cada\s+agente\s+commitea/i);
    expect(orch.content).toContain("git-collaboration");
  });

  it("includes the existing-docs update protocol when existingDocs is true", () => {
    const config = docConfig({ detection: { stackId: null, evidence: [], existingDocs: true, hasGit: false } });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).toContain("Protocolo de actualizacion de documentacion existente");
    // Reforzado en 0.1.26: ahora exige escalamiento explicito y cita la skill anti-overwrite + iteration-strategy
    expect(orch.content).toMatch(/anti-overwrite/);
    expect(orch.content).toMatch(/existing-docs-update-protocol/);
    expect(orch.content).toMatch(/iteration-strategy/);
    expect(orch.content).toMatch(/Abax-Memory v2/);
  });

  it("does NOT include any of those sections in modes 'new' or 'continue' without flags", () => {
    const config = docConfig({ mode: "new", detection: undefined });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).not.toContain("Modo DOCUMENTACION");
    expect(orch.content).not.toContain("Protocolo de commits por fase");
    expect(orch.content).not.toContain("Protocolo de actualizacion de documentacion existente");
  });
});

describe("agent template: update-existing rule", () => {
  it("opencode agents include the update-existing rule", () => {
    const config = docConfig({ mode: "new" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const someAgent = result.files.find(
      (f) => f.path.startsWith(".opencode/agents/") && f.path !== ".opencode/agents/orchestrator.md",
    );
    expect(someAgent).toBeDefined();
    expect(someAgent!.content).toContain("Actualizar un archivo existente");
  });

  it("claude agents include the update-existing rule", () => {
    const config = docConfig({ mode: "new", target: "claude" });
    const selection = runSelection(config, ctx);
    const result = runPipeline(config, selection, ctx);
    const someAgent = result.files.find(
      (f) => f.path.startsWith(".claude/agents/") && f.path !== ".claude/agents/orchestrator.md",
    );
    expect(someAgent).toBeDefined();
    expect(someAgent!.content).toContain("Actualizar un archivo existente");
  });
});
