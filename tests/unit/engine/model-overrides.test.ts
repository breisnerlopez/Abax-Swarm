import { describe, it, expect } from "vitest";
import {
  specFromOverride,
  applyExplicitOverrides,
} from "../../../src/engine/model-mapping.js";
import type { ModelMix } from "../../../src/engine/types.js";

describe("specFromOverride", () => {
  it("string form: bare model id gets provider prefix from inference (claude-* → anthropic)", () => {
    const spec = specFromOverride("claude-opus-4-7", "openai");
    expect(spec).toEqual({ model: "anthropic/claude-opus-4-7" });
  });

  it("string form: bare model id gets provider prefix from inference (gpt-* → openai)", () => {
    const spec = specFromOverride("gpt-5-mini", "anthropic");
    expect(spec).toEqual({ model: "openai/gpt-5-mini" });
  });

  it("string form: prefixed model id is preserved as-is", () => {
    const spec = specFromOverride("anthropic/claude-sonnet-4-6", "openai");
    expect(spec).toEqual({ model: "anthropic/claude-sonnet-4-6" });
  });

  it("string form: unrecognised bare id falls back to default provider", () => {
    const spec = specFromOverride("custom-model", "anthropic");
    expect(spec).toEqual({ model: "anthropic/custom-model" });
  });

  it("object form: anthropic + reasoning_effort high → thinking budget 32000", () => {
    const spec = specFromOverride(
      { provider: "anthropic", model: "claude-opus-4-7", reasoning_effort: "high" },
      "openai",
    );
    expect(spec).toEqual({
      model: "anthropic/claude-opus-4-7",
      thinking: { type: "enabled", budgetTokens: 32000 },
    });
  });

  it("object form: openai + reasoning_effort medium → reasoningEffort 'medium'", () => {
    const spec = specFromOverride(
      { provider: "openai", model: "gpt-5", reasoning_effort: "medium" },
      "anthropic",
    );
    expect(spec).toEqual({
      model: "openai/gpt-5",
      reasoningEffort: "medium",
    });
  });

  it("object form: anthropic + reasoning_effort none → no thinking field", () => {
    const spec = specFromOverride(
      { provider: "anthropic", model: "claude-haiku-4-5", reasoning_effort: "none" },
      "anthropic",
    );
    expect(spec).toEqual({ model: "anthropic/claude-haiku-4-5" });
  });
});

describe("applyExplicitOverrides", () => {
  const baseMix: ModelMix = {
    "developer-backend": { model: "openai/gpt-5-mini" },
    "qa-functional": { model: "openai/gpt-5-nano" },
  };

  it("returns the same mix reference when overrides is undefined (no-op fast path)", () => {
    const out = applyExplicitOverrides(baseMix, undefined, "openai");
    expect(out).toBe(baseMix);
  });

  it("returns the same mix reference when overrides is empty (no-op fast path)", () => {
    const out = applyExplicitOverrides(baseMix, {}, "openai");
    expect(out).toBe(baseMix);
  });

  it("replaces only the role(s) declared in overrides", () => {
    const out = applyExplicitOverrides(
      baseMix,
      {
        "developer-backend": { provider: "anthropic", model: "claude-sonnet-4-6", reasoning_effort: "low" },
      },
      "openai",
    );
    expect(out["developer-backend"]).toEqual({
      model: "anthropic/claude-sonnet-4-6",
      thinking: { type: "enabled", budgetTokens: 4000 },
    });
    expect(out["qa-functional"]).toEqual(baseMix["qa-functional"]); // untouched
  });

  it("ADDS roles that were not in the base mix (covers modelStrategy=inherit)", () => {
    const out = applyExplicitOverrides(
      {} as ModelMix,
      { orchestrator: "claude-opus-4-7" },
      "openai",
    );
    expect(out).toEqual({
      orchestrator: { model: "anthropic/claude-opus-4-7" },
    });
  });

  it("does not mutate the input mix", () => {
    const snapshot = JSON.parse(JSON.stringify(baseMix));
    applyExplicitOverrides(baseMix, { "developer-backend": "claude-haiku-4-5" }, "openai");
    expect(baseMix).toEqual(snapshot);
  });
});
