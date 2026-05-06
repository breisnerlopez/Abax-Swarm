import type { CognitiveTier, ReasoningLevel, ModelOverride } from "../loader/schemas.js";
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

/**
 * Infer provider from a bare model id when the override doesn't declare one.
 * Falls back to the project's configured provider.
 */
function inferProvider(modelId: string, fallback: Provider): Provider {
  if (/^(anthropic\/|claude-|opus-|sonnet-|haiku-)/i.test(modelId)) return "anthropic";
  if (/^(openai\/|gpt-|o1-|o3-|o4-)/i.test(modelId)) return "openai";
  return fallback;
}

/** Add provider prefix if the model id is bare. */
function ensurePrefix(modelId: string, provider: Provider): string {
  if (modelId.includes("/")) return modelId;
  return `${provider}/${modelId}`;
}

/**
 * Convert a single ModelOverride (string or object form) into a ModelSpec
 * compatible with what `modelSpecFor()` produces. Used by
 * `applyExplicitOverrides()` to honour project-level escape hatches over
 * the default cognitive_tier+reasoning lookup.
 */
export function specFromOverride(
  override: ModelOverride,
  defaultProvider: Provider,
): ModelSpec {
  if (typeof override === "string") {
    const provider = inferProvider(override, defaultProvider);
    const model = ensurePrefix(override, provider);
    return { model };
  }
  const provider = override.provider ?? inferProvider(override.model, defaultProvider);
  const model = ensurePrefix(override.model, provider);
  if (override.reasoning_effort === undefined) return { model };
  if (provider === "anthropic") {
    const budget = ANTHROPIC_BUDGET[override.reasoning_effort];
    if (budget === null) return { model };
    return { model, thinking: { type: "enabled", budgetTokens: budget } };
  }
  return { model, reasoningEffort: OPENAI_EFFORT[override.reasoning_effort] };
}

/**
 * Apply per-role explicit overrides on top of an existing mix. Each entry
 * REPLACES whatever the cognitive_tier+reasoning lookup produced (or fills
 * in roles that were skipped under modelStrategy="inherit").
 *
 * Returns a NEW mix; does not mutate the input.
 */
export function applyExplicitOverrides(
  mix: ModelMix,
  overrides: Record<string, ModelOverride> | undefined,
  defaultProvider: Provider,
): ModelMix {
  if (!overrides || Object.keys(overrides).length === 0) return mix;
  const merged: ModelMix = { ...mix };
  for (const [roleId, override] of Object.entries(overrides)) {
    merged[roleId] = specFromOverride(override, defaultProvider);
  }
  return merged;
}
