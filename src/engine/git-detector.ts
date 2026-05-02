import { existsSync, statSync } from "fs";
import { join } from "path";

/**
 * True when targetDir/.git exists. Accepts both .git directory (regular repo)
 * and .git file (worktree pointer).
 */
export function hasGitRepo(targetDir: string): boolean {
  const gitPath = join(targetDir, ".git");
  if (!existsSync(gitPath)) return false;
  try {
    const s = statSync(gitPath);
    return s.isDirectory() || s.isFile();
  } catch {
    return false;
  }
}
