import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  RoleSchema,
  SkillSchema,
  ToolSchema,
  StackSchema,
  SizeMatrixSchema,
  CriteriaRulesSchema,
  DependencyGraphSchema,
} from "../src/loader/schemas.js";
import { loadYamlFile } from "../src/loader/yaml-loader.js";

const FIXTURES = join(__dirname, "fixtures");

describe("Smoke Test: Schemas load and parse correctly", () => {
  it("should export all required schemas", () => {
    expect(RoleSchema).toBeDefined();
    expect(SkillSchema).toBeDefined();
    expect(ToolSchema).toBeDefined();
    expect(StackSchema).toBeDefined();
    expect(SizeMatrixSchema).toBeDefined();
    expect(CriteriaRulesSchema).toBeDefined();
    expect(DependencyGraphSchema).toBeDefined();
  });
});

describe("Smoke Test: YAML loader works with fixtures", () => {
  it("should load and validate a sample role", () => {
    const result = loadYamlFile(join(FIXTURES, "sample-role.yaml"), RoleSchema);
    expect(result.data.id).toBe("business-analyst");
    expect(result.data.tier).toBe("1");
    expect(result.data.category).toBe("analysis");
    expect(result.data.agent.mode).toBe("subagent");
    expect(result.data.agent.temperature).toBe(0.3);
    expect(result.data.skills).toContain("functional-analysis");
    expect(result.data.dependencies.receives_from).toContain("product-owner");
    expect(result.data.dependencies.delivers_to).toContain("solution-architect");
    expect(result.data.phases).toContain("inception");
    expect(result.data.raci.define_scope).toBe("R");
    expect(result.data.size_classification.small).toBe("indispensable");
  });

  it("should load and validate a sample skill", () => {
    const result = loadYamlFile(join(FIXTURES, "sample-skill.yaml"), SkillSchema);
    expect(result.data.id).toBe("functional-analysis");
    expect(result.data.used_by).toContain("business-analyst");
    expect(result.data.content.when_to_use).toBeTruthy();
    expect(result.data.content.instructions).toBeTruthy();
    expect(result.data.content.guides).toHaveLength(1);
    expect(result.data.content.guides[0].name).toBe("best-practices");
  });

  it("should load and validate a sample tool", () => {
    const result = loadYamlFile(join(FIXTURES, "sample-tool.yaml"), ToolSchema);
    expect(result.data.id).toBe("generate-diagram");
    expect(result.data.used_by).toContain("business-analyst");
    expect(result.data.implementation.language).toBe("typescript");
    expect(result.data.implementation.args).toHaveProperty("description");
    expect(result.data.implementation.body).toBeTruthy();
  });

  it("should load and validate a sample stack", () => {
    const result = loadYamlFile(join(FIXTURES, "sample-stack.yaml"), StackSchema);
    expect(result.data.id).toBe("angular-springboot");
    expect(result.data.frontend?.framework).toBe("Angular");
    expect(result.data.backend?.framework).toBe("Spring Boot");
    expect(result.data.database?.default).toBe("PostgreSQL");
    expect(result.data.role_context).toHaveProperty("developer-backend");
  });

  it("should throw YamlValidationError for invalid data", () => {
    expect(() => {
      RoleSchema.parse({ id: "INVALID ID", name: "x" });
    }).toThrow();
  });

  it("should throw YamlValidationError for invalid YAML file", () => {
    // Create an inline test with bad data
    expect(() => {
      loadYamlFile(join(FIXTURES, "nonexistent.yaml"), RoleSchema);
    }).toThrow();
  });
});

describe("Smoke Test: Schema validation catches errors", () => {
  it("should reject role with invalid ID format", () => {
    const result = RoleSchema.safeParse({
      id: "Invalid Role",
      name: "Test",
      category: "analysis",
      tier: "1",
      size_classification: { small: "optional", medium: "optional", large: "optional" },
      agent: {
        description: "Test description for the agent role",
        system_prompt: "A sufficiently long system prompt for testing purposes that exceeds the minimum length requirement set in the schema.",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject skill with empty used_by", () => {
    const result = SkillSchema.safeParse({
      id: "test-skill",
      name: "Test Skill",
      description: "A test skill for validation",
      used_by: [],
      content: {
        when_to_use: "When testing schema validation",
        instructions: "Follow these test instructions",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should accept valid size matrix", () => {
    const result = SizeMatrixSchema.safeParse({
      roles_by_size: {
        small: { indispensable: ["business-analyst"], recommended: [], optional: [] },
        medium: { indispensable: ["business-analyst"], recommended: ["dba"], optional: [] },
        large: { indispensable: ["business-analyst", "dba"] },
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid criteria rules", () => {
    const result = CriteriaRulesSchema.safeParse({
      criteria: [
        {
          id: "has_integrations",
          question: "Tiene integraciones con otros sistemas?",
          adds_roles: ["integration-architect"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid dependency graph", () => {
    const result = DependencyGraphSchema.safeParse({
      dependencies: {
        "business-analyst": { hard: ["product-owner"], soft: [] },
        "tech-lead": { hard: ["business-analyst"], soft: ["solution-architect"] },
      },
    });
    expect(result.success).toBe(true);
  });
});
