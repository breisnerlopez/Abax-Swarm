import type { Role } from "../loader/schemas.js";
import type { GeneratedFile } from "../generator/opencode/agent-generator.js";
import type { ValidationResult } from "./types.js";

export type OrchestratorValidationResult = ValidationResult;

/**
 * Validates that the orchestrator file only references agents that exist in the team.
 */
export function validateOrchestrator(
  orchestratorFile: GeneratedFile,
  teamRoles: Role[],
): OrchestratorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const teamIds = new Set(teamRoles.map((r) => r.id));

  // Extract all agent references from the orchestrator content
  const mentions = extractMentions(orchestratorFile.content);
  const allRefs = extractAgentRefs(orchestratorFile.content, teamIds);

  for (const mention of mentions) {
    if (!teamIds.has(mention)) {
      errors.push(`Orchestrator references @${mention} but this agent is not in the team.`);
    }
  }

  // Check that all team members are mentioned at least once (via @mention or bare ID)
  for (const role of teamRoles) {
    if (!mentions.has(role.id) && !allRefs.has(role.id)) {
      warnings.push(`Agent @${role.id} is in the team but not referenced in orchestrator.`);
    }
  }

  // Check required sections exist
  const requiredSections = [
    "Equipo disponible",
    "Matriz RACI",
    "Reglas INQUEBRANTABLES",
  ];
  for (const section of requiredSections) {
    if (!orchestratorFile.content.includes(section)) {
      errors.push(`Orchestrator is missing required section: "${section}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    notices: [],
  };
}

/**
 * Extracts @mention IDs from content, ignoring code blocks (``` ... ```).
 */
function extractMentions(content: string): Set<string> {
  // Remove code blocks and inline code to avoid false positives from examples
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
  const regex = /@([a-z0-9]+(?:-[a-z0-9]+)*)/g;
  const mentions = new Set<string>();
  let match;
  while ((match = regex.exec(withoutCodeBlocks)) !== null) {
    mentions.add(match[1]);
  }
  return mentions;
}

/**
 * Extracts bare agent ID references (without @) by matching known team IDs in content.
 */
function extractAgentRefs(content: string, teamIds: Set<string>): Set<string> {
  const found = new Set<string>();
  for (const id of teamIds) {
    if (content.includes(id)) {
      found.add(id);
    }
  }
  return found;
}
