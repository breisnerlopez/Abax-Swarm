import { z } from "zod";

// ============================================================
// Enums and shared types
// ============================================================

export const RoleTier = z.enum(["1", "2", "3"]);
export type RoleTier = z.infer<typeof RoleTier>;

export const AgentMode = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof AgentMode>;

export const PermissionLevel = z.enum(["allow", "deny", "ask"]);
export type PermissionLevel = z.infer<typeof PermissionLevel>;

export const SizeClassification = z.enum(["indispensable", "recommended", "optional", "conditional"]);
export type SizeClassification = z.infer<typeof SizeClassification>;

export const ProjectSize = z.enum(["small", "medium", "large"]);
export type ProjectSize = z.infer<typeof ProjectSize>;

export const RaciValue = z.enum(["R", "A", "C", "I", "A/R"]);
export type RaciValue = z.infer<typeof RaciValue>;

export const RoleCategory = z.enum([
  "governance",
  "business",
  "management",
  "analysis",
  "architecture",
  "security",
  "technology",
  "construction",
  "data",
  "quality",
  "validation",
  "deployment",
  "operations",
  "change",
  "documentation",
  "platform",
  "control",
  "experience",
]);
export type RoleCategory = z.infer<typeof RoleCategory>;

// ============================================================
// Role Schema
// ============================================================

const StackOverrideSchema = z.object({
  prompt_append: z.string().optional(),
  instructions_append: z.string().optional(),
  tools_add: z.array(z.string()).optional(),
  tools_remove: z.array(z.string()).optional(),
});

export const CognitiveTier = z.enum(["strategic", "implementation", "mechanical"]);
export type CognitiveTier = z.infer<typeof CognitiveTier>;

export const ReasoningLevel = z.enum(["none", "low", "medium", "high"]);
export type ReasoningLevel = z.infer<typeof ReasoningLevel>;

const AgentConfigSchema = z.object({
  mode: AgentMode.default("subagent"),
  temperature: z.number().min(0).max(1).default(0.3),
  description: z.string().min(10).max(1024),
  system_prompt: z.string().min(50),
  permissions: z
    .record(z.string(), PermissionLevel)
    .default({ read: "allow", edit: "allow", bash: "deny" }),
  tools_enabled: z.record(z.string(), z.boolean()).default({}),
  cognitive_tier: CognitiveTier.default("implementation"),
  reasoning: ReasoningLevel.default("none"),
  // Optional override for the OpenCode TUI color. Hex (e.g. "#ff6b6b") or theme key
  // (primary | secondary | accent | success | warning | error | info). If omitted,
  // src/engine/color-resolver.ts assigns one deterministically from a curated palette.
  color: z.string().optional(),
});

const DependencyBlockSchema = z.object({
  receives_from: z.array(z.string()).default([]),
  delivers_to: z.array(z.string()).default([]),
});

export const RoleSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Role ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  category: RoleCategory,
  tier: RoleTier,
  size_classification: z.object({
    small: SizeClassification,
    medium: SizeClassification,
    large: SizeClassification,
  }),
  agent: AgentConfigSchema,
  skills: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  stack_overrides: z.record(z.string(), StackOverrideSchema).default({}),
  dependencies: DependencyBlockSchema.default({ receives_from: [], delivers_to: [] }),
  phases: z.array(z.string()).default([]),
  raci: z.record(z.string(), RaciValue).default({}),
});
export type Role = z.infer<typeof RoleSchema>;

// ============================================================
// Skill Schema
// ============================================================

const SkillGuideSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(10),
});

export const SkillSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Skill ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(1024),
  used_by: z.array(z.string()).min(1),
  content: z.object({
    when_to_use: z.string().min(10),
    instructions: z.string().min(20),
    guides: z.array(SkillGuideSchema).default([]),
  }),
  stack_overrides: z.record(z.string(), z.object({ instructions_append: z.string() })).default({}),
});
export type Skill = z.infer<typeof SkillSchema>;

// ============================================================
// Tool Schema
// ============================================================

const ToolArgSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().min(5),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  required: z.boolean().default(true),
});

export const ToolSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Tool ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(1024),
  used_by: z.array(z.string()).min(1),
  implementation: z.object({
    language: z.enum(["typescript", "javascript", "python", "bash"]).default("typescript"),
    args: z.record(z.string(), ToolArgSchema).default({}),
    returns: z.string().default("string"),
    body: z.string().min(5),
  }),
});
export type Tool = z.infer<typeof ToolSchema>;

// ============================================================
// Stack Schema
// ============================================================

const StackLayerSchema = z.object({
  framework: z.string(),
  language: z.string(),
  version: z.string().optional(),
  package_manager: z.string().optional(),
  test_framework: z.string().optional(),
  build_tool: z.string().optional(),
  orm: z.string().optional(),
});

export const StackSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Stack ID must be lowercase kebab-case"),
  name: z.string().min(3).max(128),
  description: z.string().min(10).max(512),
  frontend: StackLayerSchema.optional(),
  backend: StackLayerSchema.optional(),
  database: z
    .object({
      default: z.string(),
      alternatives: z.array(z.string()).default([]),
    })
    .optional(),
  devops: z
    .object({
      containerization: z.string().optional(),
      orchestration: z.string().optional(),
      ci_cd: z.string().optional(),
      cloud: z.string().optional(),
    })
    .optional(),
  role_context: z.record(z.string(), z.string()).default({}),
});
export type Stack = z.infer<typeof StackSchema>;

// ============================================================
// Rules Schemas
// ============================================================

export const SizeMatrixSchema = z.object({
  roles_by_size: z.object({
    small: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
    medium: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
    large: z.object({
      indispensable: z.array(z.string()),
      recommended: z.array(z.string()).default([]),
      optional: z.array(z.string()).default([]),
    }),
  }),
});
export type SizeMatrix = z.infer<typeof SizeMatrixSchema>;

const CriterionSchema = z.object({
  id: z.string(),
  question: z.string().min(10),
  adds_roles: z.array(z.string()).min(1),
});

export const CriteriaRulesSchema = z.object({
  criteria: z.array(CriterionSchema).min(1),
});
export type CriteriaRules = z.infer<typeof CriteriaRulesSchema>;

const DependencyEntrySchema = z.object({
  hard: z.array(z.string()).default([]),
  soft: z.array(z.string()).default([]),
});

export const DependencyGraphSchema = z.object({
  dependencies: z.record(z.string(), DependencyEntrySchema),
});
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

export const RaciMatrixSchema = z.object({
  activities: z.record(z.string(), z.record(z.string(), RaciValue)),
});
export type RaciMatrix = z.infer<typeof RaciMatrixSchema>;

// ============================================================
// Iron Laws Schema
// ============================================================

const IronLawSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  applies_to: z.array(z.string()).min(1),
  law: z.string().min(10),
  rationale: z.string().min(10),
  violations: z.array(z.string()).default([]),
});

export const IronLawsSchema = z.object({
  iron_laws: z.array(IronLawSchema).min(1),
});
export type IronLaws = z.infer<typeof IronLawsSchema>;

// ============================================================
// Anti-Rationalization Schema
// ============================================================

const RedFlagGroupSchema = z.object({
  category: z.string().min(3),
  applies_to: z.array(z.string()).min(1),
  red_flags: z.array(
    z.object({
      thought: z.string().min(5),
      reality: z.string().min(5),
      correct_action: z.string().min(5),
    })
  ).min(1),
});

export const AntiRationalizationSchema = z.object({
  red_flag_groups: z.array(RedFlagGroupSchema).min(1),
});
export type AntiRationalization = z.infer<typeof AntiRationalizationSchema>;

// ============================================================
// Phase Deliverables Schema
// ============================================================

const DeliverableSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  responsible: z.string(),
  approver: z.string(),
  mandatory: z.boolean().default(true),
  artifact_type: z.enum(["document", "presentation", "diagram", "code", "report", "checklist"]),
});

const PhaseGateSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  gate_approver: z.string(),
  deliverables: z.array(DeliverableSchema).min(1),
});

export const PhaseDeliverablesSchema = z.object({
  phases: z.array(PhaseGateSchema).min(1),
});
export type PhaseDeliverables = z.infer<typeof PhaseDeliverablesSchema>;

// ============================================================
// Document Mode Schema
// ============================================================
// Curated team and 5-phase flow used when ProjectMode === "document".

const DocumentModePhaseSchema = z.object({
  id: z.string(),
  name: z.string().min(3),
  description: z.string().min(10),
});

export const DocumentModeSchema = z.object({
  id: z.literal("document-mode"),
  name: z.string().min(3),
  roles: z.array(z.string()).min(1),
  optional_roles: z.record(z.string(), z.object({ question: z.string().min(10) })).default({}),
  extra_skills: z.array(z.string()).default([]),
  phases: z.array(DocumentModePhaseSchema).min(1),
});
export type DocumentModeData = z.infer<typeof DocumentModeSchema>;
