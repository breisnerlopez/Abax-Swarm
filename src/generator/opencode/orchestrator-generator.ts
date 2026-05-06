import type { Role, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../../loader/schemas.js";
import type { GovernanceDetails } from "../../engine/governance-resolver.js";
import { ORCHESTRATOR_COLOR } from "../../engine/color-resolver.js";
import { renderTemplate } from "./template-engine.js";
import type { GeneratedFile } from "./agent-generator.js";
import { resolveWithFallback } from "../../engine/role-fallback.js";

interface PhaseParticipant {
  roleId: string;
  raci: string;
}

interface PhaseInfo {
  name: string;
  participants: PhaseParticipant[];
}

interface DependencyLink {
  from: string;
  to: string;
}

interface PhaseGateInfo {
  order: number;
  id: string;
  name: string;
  gateApprover: string;
  deliverables: Array<{ name: string; responsible: string; mandatory: boolean }>;
}

export interface OrchestratorFlags {
  /** "document" enables the documentation flow section. */
  mode?: "new" | "document" | "continue";
  /** When true, deliverables update existing files instead of overwriting. */
  existingDocs?: boolean;
  /** When true, the orchestrator emits a per-phase commit suggestion block. */
  hasGit?: boolean;
  /** Ordered phase list used in document mode (replaces the cascade flow). */
  documentPhases?: Array<{ id: string; name: string; description: string }>;
}

/**
 * Generates the orchestrator agent file with dynamic team knowledge.
 */
export function generateOrchestratorFile(
  projectName: string,
  agents: Role[],
  depGraph: DependencyGraph,
  raciMatrix: RaciMatrix,
  governance: GovernanceDetails,
  phaseDeliverables?: PhaseDeliverables,
  flags: OrchestratorFlags = {},
): GeneratedFile {
  const phases = buildPhases(agents, raciMatrix);
  const dependencyChain = buildDependencyChain(agents, depGraph);
  const phaseGates = buildPhaseGates(phaseDeliverables, agents);

  const agentIds = new Set(agents.map((a) => a.id));
  const discovery = {
    visionAgent: agentIds.has("product-owner") ? "product-owner" : "business-analyst",
    backlogAgent: agentIds.has("product-owner") ? "product-owner" : "business-analyst",
    designSystemAgent: agentIds.has("ux-designer") ? "ux-designer" : "business-analyst",
    hasUxDesigner: agentIds.has("ux-designer"),
    hasProductOwner: agentIds.has("product-owner"),
  };

  const isDocumentMode = flags.mode === "document";
  const description = isDocumentMode
    ? `Orquestador del proyecto ${projectName}. Coordina ${agents.length} agentes siguiendo flujo de documentacion (5 fases).`
    : `Orquestador del proyecto ${projectName}. Coordina ${agents.length} agentes siguiendo flujo cascada.`;

  // env-verification deliverable lead: prefer devops when present, fall back to tech-lead.
  // Used by the orchestrator template's "Protocolo de inicio de fase Construccion" block.
  const envVerificationLead = agentIds.has("devops")
    ? "devops"
    : agentIds.has("tech-lead")
      ? "tech-lead"
      : null;

  // deployment-plan deliverable lead: same fallback. Approver is product-owner
  // (sponsor proxy) when available, else project-manager. Section is rendered
  // only when both lead and approver are in the team — otherwise the project
  // doesn't reach phase 7 anyway.
  const deploymentPlanLead = envVerificationLead;
  const deploymentPlanApprover = agentIds.has("product-owner")
    ? "product-owner"
    : agentIds.has("project-manager")
      ? "project-manager"
      : null;

  // Resolve narrative_only phases (e.g. Discovery) into rendered markdown
  // blocks. The narrative_markdown field in phase-deliverables.yaml uses
  // single-brace placeholders ({visionAgent}) which we substitute against
  // the discovery context here. The template renders narrativeBlocks
  // BEFORE the structured phaseGates loop, preserving phase numbering
  // (Fase 0 narrative, Fase 1+ structured).
  const narrativeBlocks = buildNarrativeBlocks(phaseDeliverables, discovery);

  const content = renderTemplate("orchestrator.md.hbs", {
    projectName,
    description,
    color: ORCHESTRATOR_COLOR,
    agents,
    phases,
    dependencyChain,
    governance,
    phaseGates,
    narrativeBlocks,
    envVerificationLead,
    envVerificationApprover: agentIds.has("tech-lead") ? "tech-lead" : envVerificationLead,
    deploymentPlanLead: deploymentPlanLead && deploymentPlanApprover ? deploymentPlanLead : null,
    deploymentPlanApprover,
    discovery,
    isDocumentMode,
    existingDocs: !!flags.existingDocs,
    hasGit: !!flags.hasGit,
    hasDevops: agentIds.has("devops"),
    documentPhases: flags.documentPhases ?? [],
    hasBusinessAnalyst: agentIds.has("business-analyst"),
    hasProductOwner: agentIds.has("product-owner"),
    hasTechLead: agentIds.has("tech-lead"),
    hasSolutionArchitect: agentIds.has("solution-architect"),
    hasSecurityArchitect: agentIds.has("security-architect"),
    hasDba: agentIds.has("dba"),
    hasDeveloperBackend: agentIds.has("developer-backend"),
    hasDeveloperFrontend: agentIds.has("developer-frontend"),
    hasQaFunctional: agentIds.has("qa-functional"),
    hasQaAutomation: agentIds.has("qa-automation"),
    hasQaPerformance: agentIds.has("qa-performance"),
    hasProjectManager: agentIds.has("project-manager"),
    hasTechWriter: agentIds.has("tech-writer"),
    enforceRoleBoundaries: !isDocumentMode && agents.length >= 2,
  });

  return {
    path: ".opencode/agents/orchestrator.md",
    content,
  };
}

function buildPhaseGates(
  phaseDeliverables: PhaseDeliverables | undefined,
  agents: Role[],
): PhaseGateInfo[] {
  if (!phaseDeliverables) return [];
  const agentIds = new Set(agents.map((a) => a.id));

  const gates: PhaseGateInfo[] = [];
  let order = 0;

  for (const p of phaseDeliverables.phases) {
    // Phases marked narrative_only are owned by the orchestrator template
    // text (e.g. Fase 0 Discovery has rich 8-step narrative). Skip them
    // here so we don't render a duplicate structured "### Fase N: ..."
    // block. The runtime plugin still sees the phase via policies.phases.
    if (p.narrative_only) continue;
    // For each mandatory deliverable, resolve responsible against the
    // team using the declared fallback chain (e.g. devops absent →
    // tech-lead). When NO candidate resolves, the deliverable is silently
    // filtered out — same behaviour as before, but now consistent with
    // policies.phases (both views see the same resolved set).
    const deliverables = p.deliverables
      .filter((d) => d.mandatory)
      .map((d) => {
        const resolved = resolveWithFallback(d.responsible, d.responsible_fallback, agentIds);
        return resolved ? { name: d.name, responsible: `@${resolved}`, mandatory: d.mandatory } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Skip phases with no actionable deliverables for this team
    if (deliverables.length === 0) continue;

    order++;
    gates.push({
      order,
      id: p.id,
      name: p.name,
      gateApprover: agentIds.has(p.gate_approver) ? `@${p.gate_approver}` : "el usuario (sponsor)",
      deliverables,
    });
  }

  return gates;
}

function buildPhases(agents: Role[], raciMatrix: RaciMatrix): PhaseInfo[] {
  const agentIds = new Set(agents.map((a) => a.id));
  const phases: PhaseInfo[] = [];

  for (const [activity, roles] of Object.entries(raciMatrix.activities)) {
    const participants: PhaseParticipant[] = [];
    for (const [roleId, raci] of Object.entries(roles)) {
      if (agentIds.has(roleId)) {
        participants.push({ roleId, raci });
      }
    }
    if (participants.length > 0) {
      phases.push({
        name: activity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        participants,
      });
    }
  }

  return phases;
}

/**
 * Build the rendered markdown blocks for narrative_only phases.
 *
 * Why this exists: Discovery (and any future narrative_only phase) carries
 * its prose in phase-deliverables.yaml as `narrative_markdown` — single
 * source of truth. The prose contains placeholders in single-brace form
 * ({visionAgent}, {backlogAgent}, {designSystemAgent}) so it doesn't
 * conflict with Handlebars syntax in the .hbs template. We substitute
 * them here against the resolved discovery context.
 *
 * To add a new placeholder: extend the substitution map below and update
 * the placeholder docstring on PhaseGateSchema.narrative_markdown in
 * src/loader/schemas.ts so authors know what's available.
 */
function buildNarrativeBlocks(
  phaseDeliverables: PhaseDeliverables | undefined,
  discovery: { visionAgent: string; backlogAgent: string; designSystemAgent: string },
): Array<{ id: string; markdown: string }> {
  if (!phaseDeliverables) return [];
  const blocks: Array<{ id: string; markdown: string }> = [];
  for (const phase of phaseDeliverables.phases) {
    if (!phase.narrative_only) continue;
    if (!phase.narrative_markdown) continue;
    const resolved = phase.narrative_markdown
      .replace(/\{visionAgent\}/g, discovery.visionAgent)
      .replace(/\{backlogAgent\}/g, discovery.backlogAgent)
      .replace(/\{designSystemAgent\}/g, discovery.designSystemAgent);
    blocks.push({ id: phase.id, markdown: resolved });
  }
  return blocks;
}

function buildDependencyChain(agents: Role[], _depGraph: DependencyGraph): DependencyLink[] {
  const agentIds = new Set(agents.map((a) => a.id));
  const links: DependencyLink[] = [];

  for (const agent of agents) {
    for (const target of agent.dependencies.delivers_to) {
      if (agentIds.has(target)) {
        links.push({ from: agent.id, to: target });
      }
    }
  }

  return links;
}
