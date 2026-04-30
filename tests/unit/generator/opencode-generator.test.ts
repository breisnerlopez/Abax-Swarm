import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../../src/loader/stack-loader.js";
import { loadAllRules } from "../../../src/loader/rule-loader.js";
import { generateAgentFile, generateAllAgentFiles } from "../../../src/generator/opencode/agent-generator.js";
import { generateSkillFile, generateAllSkillFiles } from "../../../src/generator/opencode/skill-generator.js";
import { generateToolFile, generateAllToolFiles } from "../../../src/generator/opencode/tool-generator.js";
import { generateOrchestratorFile } from "../../../src/generator/opencode/orchestrator-generator.js";
import { generateOpenCodeConfig, generateProjectManifest } from "../../../src/generator/opencode/config-generator.js";
import { resolveGovernance } from "../../../src/engine/governance-resolver.js";
import type { Role, Skill, Tool, Stack } from "../../../src/loader/schemas.js";

const DATA_DIR = join(__dirname, "../../../data");
let roles: Map<string, Role>;
let skills: Map<string, Skill>;
let tools: Map<string, Tool>;
let stacks: Map<string, Stack>;
let rules: ReturnType<typeof loadAllRules>;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  skills = loadSkillsAsMap(join(DATA_DIR, "skills"));
  tools = loadToolsAsMap(join(DATA_DIR, "tools"));
  stacks = loadStacksAsMap(join(DATA_DIR, "stacks"));
  rules = loadAllRules(join(DATA_DIR, "rules"));
});

describe("AgentGenerator", () => {
  it("should generate a valid agent .md file", () => {
    const ba = roles.get("business-analyst")!;
    const skillList = Array.from(skills.values());
    const file = generateAgentFile(ba, skillList);

    expect(file.path).toBe(".opencode/agents/business-analyst.md");
    expect(file.content).toContain("---");
    expect(file.content).toContain("description:");
    expect(file.content).toContain("mode: subagent");
    expect(file.content).toContain("temperature: 0.3");
    expect(file.content).toContain("Eres un Business Analyst");
    expect(file.content).toContain("Skills disponibles");
    expect(file.content).toContain("Analisis Funcional");
  });

  it("should generate files for all roles", () => {
    const roleList = Array.from(roles.values());
    const skillList = Array.from(skills.values());
    const files = generateAllAgentFiles(roleList, skillList);

    expect(files.length).toBe(roleList.length);
    for (const file of files) {
      expect(file.path).toMatch(/^\.opencode\/agents\/.+\.md$/);
      expect(file.content).toContain("---");
    }
  });

  it("should include dependency info in agent file", () => {
    const ba = roles.get("business-analyst")!;
    const file = generateAgentFile(ba, []);

    expect(file.content).toContain("Recibe insumos de");
    expect(file.content).toContain("@product-owner");
    expect(file.content).toContain("Entrega resultados a");
    expect(file.content).toContain("@solution-architect");
  });
});

describe("SkillGenerator", () => {
  it("should generate SKILL.md + guides", () => {
    const fa = skills.get("functional-analysis")!;
    const files = generateSkillFile(fa);

    expect(files.length).toBeGreaterThanOrEqual(2); // SKILL.md + at least 1 guide
    expect(files[0].path).toBe(".opencode/skills/functional-analysis/SKILL.md");
    expect(files[0].content).toContain("name: functional-analysis");
    expect(files[0].content).toContain("Proceso de Analisis Funcional");

    // Guide file
    const guide = files.find((f) => f.path.includes("guides/"));
    expect(guide).toBeDefined();
    expect(guide!.path).toContain("best-practices.md");
  });

  it("should generate all skill files", () => {
    const skillList = Array.from(skills.values());
    const files = generateAllSkillFiles(skillList);

    expect(files.length).toBeGreaterThan(skillList.length); // SKILL.md + guides
    const skillMds = files.filter((f) => f.path.endsWith("SKILL.md"));
    expect(skillMds.length).toBe(skillList.length);
  });
});

describe("ToolGenerator", () => {
  it("should generate a TypeScript tool file", () => {
    const diagramTool = tools.get("generate-diagram")!;
    const file = generateToolFile(diagramTool);

    expect(file.path).toBe(".opencode/tools/generate-diagram.ts");
    expect(file.content).toContain("import { tool }");
    expect(file.content).toContain("description:");
    expect(file.content).toContain("execute(args");
  });

  it("should generate all tool files", () => {
    const toolList = Array.from(tools.values());
    const files = generateAllToolFiles(toolList);

    expect(files.length).toBe(toolList.length);
    for (const file of files) {
      expect(file.path).toMatch(/^\.opencode\/tools\/.+\.ts$/);
    }
  });
});

describe("OrchestratorGenerator", () => {
  it("should generate orchestrator with team knowledge", () => {
    const teamRoles = [
      roles.get("business-analyst")!,
      roles.get("tech-lead")!,
      roles.get("developer-backend")!,
      roles.get("qa-functional")!,
    ];
    const governance = resolveGovernance("medium");

    const file = generateOrchestratorFile(
      "sistema-ventas",
      teamRoles,
      rules.dependencies,
      rules.raci,
      governance,
    );

    expect(file.path).toBe(".opencode/agents/orchestrator.md");
    expect(file.content).toContain("sistema-ventas");
    expect(file.content).toContain("business-analyst");
    expect(file.content).toContain("tech-lead");
    expect(file.content).toContain("developer-backend");
    expect(file.content).toContain("qa-functional");
    expect(file.content).toContain("Equipo Controlado");
    expect(file.content).toContain("NUNCA");
    expect(file.content).toContain("mode: primary");
  });

  it("should only reference active agents in dependency chain", () => {
    const teamRoles = [
      roles.get("business-analyst")!,
      roles.get("tech-lead")!,
    ];
    const governance = resolveGovernance("small");

    const file = generateOrchestratorFile(
      "test-project",
      teamRoles,
      rules.dependencies,
      rules.raci,
      governance,
    );

    // Should not reference developer-backend as it's not in the team
    // (dependency chain only includes active agents)
    expect(file.content).not.toContain("@developer-backend");
  });
});

describe("ConfigGenerator", () => {
  it("should generate valid opencode.json", () => {
    const agentList = [
      roles.get("business-analyst")!,
      roles.get("developer-backend")!,
    ];
    const file = generateOpenCodeConfig(agentList);

    expect(file.path).toBe("opencode.json");
    // Should be valid JSON
    const parsed = JSON.parse(file.content);
    expect(parsed).toHaveProperty("$schema");
    expect(parsed).toHaveProperty("agent");
    expect(parsed.agent).toHaveProperty("orchestrator");
    expect(parsed.agent).toHaveProperty("business-analyst");
    expect(parsed.agent).toHaveProperty("developer-backend");

    // Orchestrator must have task:allow for subagent delegation
    expect(parsed.agent.orchestrator.permission.task).toBe("allow");
    expect(parsed.agent.orchestrator.mode).toBe("primary");

    // Agents must NOT have deprecated 'tools' field
    expect(parsed.agent["business-analyst"]).not.toHaveProperty("tools");
    expect(parsed.agent["developer-backend"]).not.toHaveProperty("tools");
    expect(parsed.agent.orchestrator).not.toHaveProperty("tools");
  });

  it("should generate project-manifest.yaml", () => {
    const governance = resolveGovernance("medium");
    const file = generateProjectManifest(
      {
        name: "test-project",
        description: "Test project",
        targetDir: "./test",
        size: "medium",
        criteria: ["has_integrations"],
        stackId: "angular-springboot",
        target: "opencode",
      },
      {
        roles: [],
        warnings: [],
        governanceModel: "controlled",
      },
      [roles.get("business-analyst")!],
      [skills.get("functional-analysis")!],
      [tools.get("generate-diagram")!],
      stacks.get("angular-springboot")!,
      governance,
    );

    expect(file.path).toBe("project-manifest.yaml");
    expect(file.content).toContain("test-project");
    expect(file.content).toContain("medium");
    expect(file.content).toContain("angular-springboot");
  });
});
