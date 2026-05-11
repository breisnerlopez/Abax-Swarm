/**
 * Single source of truth for emitted artifact paths.
 *
 * TS code (generators, validators, pipeline) imports from here. Templates
 * (the abax-policy plugin TS, the Python hook, custom tool YAMLs)
 * inevitably hardcode the same strings — they run in the project at
 * runtime without access to abax-swarm. The invariant test
 * `tests/integration/path-consistency.test.ts` scans those template
 * files and asserts they match these constants, so any rename is
 * caught at commit time instead of after a regenerate.
 *
 * Keep these constants in sync with:
 *   - templates/opencode/plugins/abax-policy.ts          (reads policies, state, debug log)
 *   - templates/claude/hooks/abax-policy.py              (reads policies, state)
 *   - data/tools/{phase-state,verify-deliverable,
 *                 attest-deliverable,set-iteration-scope}.yaml
 *                                                       (read policies, write attestations / state)
 */

// ---- OpenCode target ----
export const OC_PLUGIN_PATH = ".opencode/plugins/abax-policy.ts";
export const OC_POLICIES_PATH = ".opencode/policies/abax-policies.json";
export const OC_ITERATION_STATE_PATH = ".opencode/iteration-state.json";
export const OC_PLUGIN_DEBUG_LOG = ".opencode/abax-policy-debug.log";
export const OC_AGENTS_DIR = ".opencode/agents";
export const OC_TOOLS_DIR = ".opencode/tools";
export const OC_SKILLS_DIR = ".opencode/skills";
// Declares @opencode-ai/plugin so generated tools (`import { tool } from
// "@opencode-ai/plugin"`) resolve at runtime. Users must run
// `cd .opencode && bun install` (or npm) once after generation.
export const OC_PACKAGE_JSON_PATH = ".opencode/package.json";
// Pinned to a caret range so patch/minor updates flow but the major is
// fixed against the SDK we tested with. Bump after validating a new major.
export const OC_PLUGIN_SDK_VERSION = "^1.14.0";

// ---- Claude target ----
export const CC_HOOK_PATH = ".claude/hooks/abax-policy.py";
export const CC_POLICIES_PATH = ".claude/policies/abax-policies.json";
export const CC_ITERATION_STATE_PATH = ".claude/iteration-state.json";
export const CC_AGENTS_DIR = ".claude/agents";
export const CC_SKILLS_DIR = ".claude/skills";

// ---- Cross-target ----
export const ATTESTATIONS_DIR = "docs/.attestations";

// ---- Backward-compat alias for code that referenced the old name. ----
export const PLUGIN_OPENCODE_PATH = OC_PLUGIN_PATH;
