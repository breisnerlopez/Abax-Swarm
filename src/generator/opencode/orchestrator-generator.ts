import type { Role, DependencyGraph, RaciMatrix, PhaseDeliverables } from "../../loader/schemas.js";
import type { GovernanceDetails } from "../../engine/governance-resolver.js";
import { ORCHESTRATOR_COLOR } from "../../engine/color-resolver.js";
import { renderTemplate } from "./template-engine.js";
import type { GeneratedFile } from "./agent-generator.js";

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

  const content = renderTemplate("orchestrator.md.hbs", {
    projectName,
    description,
    color: ORCHESTRATOR_COLOR,
    agents,
    phases,
    dependencyChain,
    governance,
    phaseGates,
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
    // Only include mandatory deliverables whose responsible agent is in the team
    const deliverables = p.deliverables
      .filter((d) => d.mandatory && agentIds.has(d.responsible))
      .map((d) => ({
        name: d.name,
        responsible: `@${d.responsible}`,
        mandatory: d.mandatory,
      }));

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
