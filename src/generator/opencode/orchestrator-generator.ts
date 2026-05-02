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

  const content = renderTemplate("orchestrator.md.hbs", {
    projectName,
    description: `Orquestador del proyecto ${projectName}. Coordina ${agents.length} agentes siguiendo flujo cascada.`,
    color: ORCHESTRATOR_COLOR,
    agents,
    phases,
    dependencyChain,
    governance,
    phaseGates,
    discovery,
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
