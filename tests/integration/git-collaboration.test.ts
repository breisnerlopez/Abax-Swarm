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
    name: "git-flow-test",
    description: "test",
    targetDir: "/tmp/git-flow-test",
    size: "medium",
    criteria: [],
    stackId: "angular-springboot",
    target: "opencode",
    teamScope: "full",
    provider: "anthropic",
    modelStrategy: "inherit",
    permissionMode: "recommended",
    isolationMode: "devcontainer",
    ...overrides,
  };
}

describe("git-collaboration skill: existence and wiring", () => {
  it("skill exists in data/skills/", () => {
    expect(ctx.skills.has("git-collaboration")).toBe(true);
  });

  it("is referenced by 5 expected tech roles", () => {
    const skill = ctx.skills.get("git-collaboration")!;
    for (const r of ["tech-lead", "devops", "developer-backend", "developer-frontend", "dba"]) {
      expect(skill.used_by, `skill should list ${r}`).toContain(r);
    }
  });

  it("each of the 5 roles lists git-collaboration in its skills", () => {
    for (const r of ["tech-lead", "devops", "developer-backend", "developer-frontend", "dba"]) {
      const role = ctx.roles.get(r)!;
      expect(role.skills, `${r} should declare git-collaboration`).toContain("git-collaboration");
    }
  });

  it("instructions cover branch creation, per-agent commit, devops push", () => {
    const skill = ctx.skills.get("git-collaboration")!;
    const text = skill.content.instructions;
    expect(text).toMatch(/abax\/\$\{?PROJECT_NAME\}?/);
    expect(text).toMatch(/checkout -b/);
    expect(text).toMatch(/--author/);
    expect(text).toMatch(/git push -u origin/);
    expect(text).toMatch(/NUNCA `git push --force`|NUNCA `git add \.`/);
  });
});

describe("orchestrator template: distributed git protocol", () => {
  it("when hasGit, opencode orchestrator references the new distributed flow", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: false, hasGit: true, hasDevcontainer: false },
    });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;

    // Mentions the distributed flow + devops as push leader (medium has devops)
    expect(orch.content).toContain("Protocolo de commits por fase");
    expect(orch.content).toMatch(/cada\s+agente\s+commitea/i);
    expect(orch.content).toMatch(/agent: devops|@devops/);
    expect(orch.content).toContain("git-collaboration");

    // Does NOT instruct the orchestrator to emit a copy-pasteable git command
    expect(orch.content).not.toMatch(/^git add docs\/<carpeta-de-la-fase>\//m);
    expect(orch.content).not.toMatch(/sugiere el comando para que el usuario lo apruebe/);
  });

  it("when hasGit but no devops in team (small lean), falls back to tech-lead", () => {
    const config = baseConfig({
      size: "small",
      teamScope: "lean",
      detection: { stackId: null, evidence: [], existingDocs: false, hasGit: true, hasDevcontainer: false },
    });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    const teamHasDevops = result.project.roles.some((r) => r.id === "devops");

    if (!teamHasDevops) {
      expect(orch.content).toMatch(/agent: tech-lead/);
      expect(orch.content).not.toMatch(/agent: devops/);
    }
  });

  it("when hasGit is false, the protocol section is omitted", () => {
    const config = baseConfig({
      detection: { stackId: null, evidence: [], existingDocs: false, hasGit: false, hasDevcontainer: false },
    });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === ".opencode/agents/orchestrator.md")!;
    expect(orch.content).not.toContain("Protocolo de commits por fase");
  });

  it("claude orchestrator also gets the distributed protocol", () => {
    const config = baseConfig({
      target: "claude",
      detection: { stackId: null, evidence: [], existingDocs: false, hasGit: true, hasDevcontainer: false },
    });
    const result = runPipeline(config, runSelection(config, ctx), ctx);
    const orch = result.files.find((f) => f.path === "CLAUDE.md")!;
    expect(orch.content).toContain("Protocolo de commits por fase");
    expect(orch.content).toMatch(/cada\s+agente|abax\/<project-name>/i);
  });
});
