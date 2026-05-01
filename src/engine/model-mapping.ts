import type { CognitiveTier, ReasoningLevel } from "../loader/schemas.js";
import type { Role } from "../loader/schemas.js";
import type { ModelMix, ModelSpec, Provider, RoleModelOverride } from "./types.js";

/**
 * Provider × tier → model id table.
 * Within a single provider, the wizard picks a different size of the same
 * family for each cognitive tier.
 */
export const PROVIDER_MODELS: Record<Provider, Record<CognitiveTier, string>> = {
  anthropic: {
    strategic: "anthropic/claude-opus-4-7",
    implementation: "anthropic/claude-sonnet-4-6",
    mechanical: "anthropic/claude-haiku-4-5",
  },
  openai: {
    strategic: "openai/gpt-5",
    implementation: "openai/gpt-5-mini",
    mechanical: "openai/gpt-5-nano",
  },
};

/** Anthropic extended-thinking budget by reasoning level. */
const ANTHROPIC_BUDGET: Record<ReasoningLevel, number | null> = {
  none: null,
  low: 4000,
  medium: 16000,
  high: 32000,
};

/** OpenAI reasoning_effort mapping by reasoning level. */
const OPENAI_EFFORT: Record<ReasoningLevel, "minimal" | "low" | "medium" | "high"> = {
  none: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
};

/**
 * Build the ModelSpec for a single (provider, tier, reasoning) tuple.
 */
export function modelSpecFor(
  provider: Provider,
  tier: CognitiveTier,
  reasoning: ReasoningLevel,
): ModelSpec {
  const model = PROVIDER_MODELS[provider][tier];
  if (provider === "anthropic") {
    const budget = ANTHROPIC_BUDGET[reasoning];
    if (budget === null) return { model };
    return { model, thinking: { type: "enabled", budgetTokens: budget } };
  }
  // openai
  return { model, reasoningEffort: OPENAI_EFFORT[reasoning] };
}

/**
 * Build the suggested mix for the given selection, applying optional per-role
 * overrides. The override (if present for a role) replaces the role's declared
 * tier/reasoning.
 */
export function buildModelMix(
  provider: Provider,
  roles: Role[],
  overrides: Record<string, RoleModelOverride> = {},
): ModelMix {
  const mix: ModelMix = {};
  for (const role of roles) {
    const override = overrides[role.id] ?? {};
    const tier = override.cognitive_tier ?? role.agent.cognitive_tier;
    const reasoning = override.reasoning ?? role.agent.reasoning;
    mix[role.id] = modelSpecFor(provider, tier, reasoning);
  }
  return mix;
}

/**
 * Group a ModelMix by ModelSpec for human-friendly display in the wizard.
 * Roles that share the same spec are bucketed together.
 */
export interface MixGroup {
  spec: ModelSpec;
  roleIds: string[];
}

export function groupMixBySpec(mix: ModelMix): MixGroup[] {
  const buckets = new Map<string, MixGroup>();
  for (const [roleId, spec] of Object.entries(mix)) {
    const key = JSON.stringify(spec);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { spec, roleIds: [] };
      buckets.set(key, bucket);
    }
    bucket.roleIds.push(roleId);
  }
  return Array.from(buckets.values());
}
