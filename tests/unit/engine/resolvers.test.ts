import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { resolveSkills, filterSkills } from "../../../src/engine/skill-resolver.js";
import { resolveTools, filterTools } from "../../../src/engine/tool-resolver.js";
import { adaptRoleToStack, adaptAllRolesToStack } from "../../../src/engine/stack-adapter.js";
import { resolveGovernance } from "../../../src/engine/governance-resolver.js";
import { loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadSkillsAsMap } from "../../../src/loader/skill-loader.js";
import { loadToolsAsMap } from "../../../src/loader/tool-loader.js";
import { loadStacksAsMap } from "../../../src/loader/stack-loader.js";
import type { Role, Skill, Tool, Stack } from "../../../src/loader/schemas.js";

const DATA_DIR = join(__dirname, "../../../data");
let roles: Map<string, Role>;
let skills: Map<string, Skill>;
let tools: Map<string, Tool>;
let stacks: Map<string, Stack>;

beforeAll(() => {
  roles = loadRolesAsMap(join(DATA_DIR, "roles"));
  skills = loadSkillsAsMap(join(DATA_DIR, "skills"));
  tools = loadToolsAsMap(join(DATA_DIR, "tools"));
  stacks = loadStacksAsMap(join(DATA_DIR, "stacks"));
});

describe("SkillResolver", () => {
  it("should resolve skills for a single role", () => {
    const result = resolveSkills(["business-analyst"], roles);
    expect(result).toContain("functional-analysis");
    expect(result).toContain("acceptance-criteria");
  });

  it("should deduplicate skills across roles", () => {
    const result = resolveSkills(["business-analyst", "qa-functional"], roles);
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });

  it("should return empty for unknown role", () => {
    const result = resolveSkills(["nonexistent"], roles);
    expect(result.length).toBe(0);
  });

  it("should return sorted IDs", () => {
    const result = resolveSkills(
      ["business-analyst", "tech-lead", "developer-backend"],
      roles,
    );
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
  });
});

describe("filterSkills", () => {
  it("should find existing skills", () => {
    const { found, missing } = filterSkills(["functional-analysis", "code-review"], skills);
    expect(found.length).toBe(2);
    expect(missing.length).toBe(0);
  });

  it("should report missing skills", () => {
    const { found, missing } = filterSkills(["functional-analysis", "nonexistent-skill"], skills);
    expect(found.length).toBe(1);
    expect(missing).toContain("nonexistent-skill");
  });
});

describe("ToolResolver", () => {
  it("should resolve tools for a single role", () => {
    const result = resolveTools(["business-analyst"], roles);
    expect(result).toContain("generate-diagram");
    expect(result).toContain("create-document");
  });

  it("should deduplicate tools across roles", () => {
    const result = resolveTools(
      ["business-analyst", "solution-architect", "tech-lead"],
      roles,
    );
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});

describe("filterTools", () => {
  it("should find all defined tools", () => {
    const allToolIds = resolveTools(
      ["business-analyst", "tech-lead", "devops"],
      roles,
    );
    const { found, missing } = filterTools(allToolIds, tools);
    expect(found.length).toBe(allToolIds.length);
    expect(missing.length).toBe(0);
  });
});

describe("StackAdapter", () => {
  it("should append stack context to role prompt", () => {
    const ba = roles.get("business-analyst")!;
    const stack = stacks.get("angular-springboot")!;
    const adapted = adaptRoleToStack(ba, stack);

    expect(adapted.agent.system_prompt).toContain("Angular");
    expect(adapted.agent.system_prompt).toContain("Spring Boot");
    expect(adapted.agent.system_prompt.length).toBeGreaterThan(ba.agent.system_prompt.length);
  });

  it("should not mutate original role", () => {
    const ba = roles.get("business-analyst")!;
    const originalPrompt = ba.agent.system_prompt;
    const stack = stacks.get("angular-springboot")!;
    adaptRoleToStack(ba, stack);

    expect(ba.agent.system_prompt).toBe(originalPrompt);
  });

  it("should return role unchanged if no overrides exist", () => {
    const orch = roles.get("orchestrator")!;
    const stack = stacks.get("angular-springboot")!;
    const adapted = adaptRoleToStack(orch, stack);

    expect(adapted.agent.system_prompt).toBe(orch.agent.system_prompt);
  });

  it("should adapt all roles at once", () => {
    const roleList = [roles.get("business-analyst")!, roles.get("developer-backend")!];
    const stack = stacks.get("react-nextjs")!;
    const adapted = adaptAllRolesToStack(roleList, stack);

    expect(adapted.length).toBe(2);
    for (const role of adapted) {
      expect(role.agent.system_prompt).toContain("Contexto del Stack");
    }
  });
});

describe("GovernanceResolver", () => {
  it("should return lightweight for small", () => {
    const gov = resolveGovernance("small");
    expect(gov.model).toBe("lightweight");
    expect(gov.name_es).toBe("Equipo Ligero");
  });

  it("should return controlled for medium", () => {
    const gov = resolveGovernance("medium");
    expect(gov.model).toBe("controlled");
    expect(gov.committees.length).toBeGreaterThan(1);
  });

  it("should return corporate for large", () => {
    const gov = resolveGovernance("large");
    expect(gov.model).toBe("corporate");
    expect(gov.committees.length).toBeGreaterThanOrEqual(5);
    expect(gov.change_control).toBe("Estricto y trazable");
    expect(gov.documentation_level).toBe("Completa y auditable");
  });
});
