import type { Role, Stack } from "../loader/schemas.js";

/**
 * Adapts a role's system prompt by appending stack-specific context.
 * Merges from two sources:
 * 1. Role's own stack_overrides (defined in the role YAML)
 * 2. Stack's role_context (defined in the stack YAML)
 *
 * Returns a new Role object with modified system_prompt (does not mutate).
 */
export function adaptRoleToStack(role: Role, stack: Stack): Role {
  const additions: string[] = [];

  // Source 1: Role-defined stack overrides
  const roleOverride = role.stack_overrides[stack.id];
  if (roleOverride?.prompt_append) {
    additions.push(roleOverride.prompt_append.trim());
  }

  // Source 2: Stack-defined role context
  const stackContext = stack.role_context[role.id];
  if (stackContext) {
    additions.push(stackContext.trim());
  }

  if (additions.length === 0) {
    return role;
  }

  const stackSection = `\n\n## Contexto del Stack: ${stack.name}\n${additions.join("\n\n")}`;

  return {
    ...role,
    agent: {
      ...role.agent,
      system_prompt: role.agent.system_prompt + stackSection,
    },
  };
}

/**
 * Adapts all roles to a specific stack.
 */
export function adaptAllRolesToStack(
  roles: Role[],
  stack: Stack,
): Role[] {
  return roles.map((role) => adaptRoleToStack(role, stack));
}
