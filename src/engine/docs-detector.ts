import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * True when targetDir contains a docs/ directory with at least one .md file
 * (recursive, capped at 3 levels to keep this fast and avoid pathological dirs).
 */
export function hasExistingDocs(targetDir: string): boolean {
  const docsDir = join(targetDir, "docs");
  if (!existsSync(docsDir)) return false;
  return walkForMarkdown(docsDir, 3);
}

function walkForMarkdown(dir: string, depth: number): boolean {
  if (depth < 0) return false;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isFile() && entry.toLowerCase().endsWith(".md")) return true;
    if (stat.isDirectory() && walkForMarkdown(full, depth - 1)) return true;
  }
  return false;
}
