import { describe, it, expect } from "vitest";
import {
  PROVIDER_MODELS,
  modelSpecFor,
  buildModelMix,
  groupMixBySpec,
} from "../../../src/engine/model-mapping.js";
import type { Role } from "../../../src/loader/schemas.js";

function makeRole(
  id: string,
  cognitive_tier: "strategic" | "implementation" | "mechanical",
  reasoning: "none" | "low" | "medium" | "high",
): Role {
  return {
    id,
    name: id,
    category: "construction",
    tier: "1",
    size_classification: { small: "indispensable", medium: "indispensable", large: "indispensable" },
    agent: {
      mode: "subagent",
      temperature: 0.3,
      description: "x".repeat(20),
      system_prompt: "y".repeat(60),
      permissions: {},
      tools_enabled: {},
      cognitive_tier,
      reasoning,
    },
    skills: [],
    tools: [],
    stack_overrides: {},
    dependencies: { receives_from: [], delivers_to: [] },
    phases: [],
    raci: {},
  } as unknown as Role;
}

describe("model-mapping", () => {
  describe("PROVIDER_MODELS table", () => {
    it("Anthropic uses opus → sonnet → haiku across tiers", () => {
      expect(PROVIDER_MODELS.anthropic.strategic).toContain("opus");
      expect(PROVIDER_MODELS.anthropic.implementation).toContain("sonnet");
      expect(PROVIDER_MODELS.anthropic.mechanical).toContain("haiku");
    });

    it("OpenAI uses gpt-5 → gpt-5-mini → gpt-5-nano across tiers", () => {
      expect(PROVIDER_MODELS.openai.strategic).toBe("openai/gpt-5");
      expect(PROVIDER_MODELS.openai.implementation).toBe("openai/gpt-5-mini");
      expect(PROVIDER_MODELS.openai.mechanical).toBe("openai/gpt-5-nano");
    });
  });

  describe("modelSpecFor — Anthropic", () => {
    it("none reasoning → no thinking", () => {
      const spec = modelSpecFor("anthropic", "strategic", "none");
      expect(spec.model).toContain("opus");
      expect(spec.thinking).toBeUndefined();
    });

    it("medium reasoning → thinking with budget 16000", () => {
      const spec = modelSpecFor("anthropic", "strategic", "medium");
      expect(spec.thinking).toEqual({ type: "enabled", budgetTokens: 16000 });
    });

    it("high reasoning → thinking with budget 32000", () => {
      const spec = modelSpecFor("anthropic", "strategic", "high");
      expect(spec.thinking).toEqual({ type: "enabled", budgetTokens: 32000 });
    });

    it("low reasoning → thinking with budget 4000", () => {
      const spec = modelSpecFor("anthropic", "implementation", "low");
      expect(spec.thinking).toEqual({ type: "enabled", budgetTokens: 4000 });
    });
  });

  describe("modelSpecFor — OpenAI", () => {
    it("maps reasoning level → reasoningEffort", () => {
      expect(modelSpecFor("openai", "strategic", "high").reasoningEffort).toBe("high");
      expect(modelSpecFor("openai", "strategic", "medium").reasoningEffort).toBe("medium");
      expect(modelSpecFor("openai", "strategic", "low").reasoningEffort).toBe("low");
      expect(modelSpecFor("openai", "mechanical", "none").reasoningEffort).toBe("minimal");
    });

    it("never emits thinking for openai", () => {
      const spec = modelSpecFor("openai", "strategic", "high");
      expect(spec.thinking).toBeUndefined();
    });
  });

  describe("buildModelMix", () => {
    const roles = [
      makeRole("orchestrator", "strategic", "high"),
      makeRole("backend", "implementation", "low"),
      makeRole("docs", "mechanical", "none"),
    ];

    it("uses each role's tier and reasoning by default", () => {
      const mix = buildModelMix("anthropic", roles);
      expect(mix.orchestrator.model).toContain("opus");
      expect(mix.backend.model).toContain("sonnet");
      expect(mix.docs.model).toContain("haiku");
      expect(mix.docs.thinking).toBeUndefined();
    });

    it("respects per-role overrides", () => {
      const mix = buildModelMix("anthropic", roles, {
        backend: { cognitive_tier: "strategic", reasoning: "medium" },
      });
      expect(mix.backend.model).toContain("opus");
      expect(mix.backend.thinking).toEqual({ type: "enabled", budgetTokens: 16000 });
    });
  });

  describe("groupMixBySpec", () => {
    it("buckets roles by identical spec", () => {
      const roles = [
        makeRole("a", "strategic", "high"),
        makeRole("b", "strategic", "high"),
        makeRole("c", "mechanical", "none"),
      ];
      const mix = buildModelMix("anthropic", roles);
      const groups = groupMixBySpec(mix);
      expect(groups.length).toBe(2);
      const opus = groups.find((g) => g.spec.model.includes("opus"))!;
      expect(opus.roleIds.sort()).toEqual(["a", "b"]);
    });
  });
});
