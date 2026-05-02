import { existsSync, readFileSync } from "fs";

/**
 * Best-effort detection of whether the current process is running inside a
 * container. Pure observation — never throws.
 *
 * Heuristics (any one is enough):
 *   - /.dockerenv exists (created by docker build/run).
 *   - /run/.containerenv exists (podman).
 *   - /proc/1/cgroup mentions docker, kubepods, lxc, podman or containerd.
 */
export function isInsideContainer(): boolean {
  if (existsSync("/.dockerenv")) return true;
  if (existsSync("/run/.containerenv")) return true;
  try {
    const cgroup = readFileSync("/proc/1/cgroup", "utf-8");
    if (/docker|kubepods|lxc|podman|containerd/i.test(cgroup)) return true;
  } catch {
    // /proc/1/cgroup may not exist (macOS, BSD, restricted env)
  }
  return false;
}

import { join } from "path";

/**
 * True when targetDir contains a .devcontainer/devcontainer.json file.
 * Used by the wizard so we don't ask the isolation question twice on
 * a project that already adopted devcontainer.
 */
export function hasDevcontainerConfig(targetDir: string): boolean {
  return existsSync(join(targetDir, ".devcontainer", "devcontainer.json"));
}
