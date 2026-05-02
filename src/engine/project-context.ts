import { detectStack } from "./stack-detector.js";
import { hasExistingDocs } from "./docs-detector.js";
import { hasGitRepo } from "./git-detector.js";
import type { ProjectContextDetection } from "./types.js";

/**
 * Aggregate detection over the target directory. Pure observation — callers
 * decide what to do with the flags.
 */
export function detectProjectContext(targetDir: string): ProjectContextDetection {
  const { stackId, evidence } = detectStack(targetDir);
  return {
    stackId,
    evidence,
    existingDocs: hasExistingDocs(targetDir),
    hasGit: hasGitRepo(targetDir),
  };
}
