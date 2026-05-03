import type { PermissionMode, IsolationMode } from "./types.js";

/**
 * Returns the JSON object to inject as the root `permission` field of
 * opencode.json given the user's choices.
 *
 * - "strict":      undefined → no root permission, only per-agent (current behaviour).
 * - "recommended": granular allowlist + denylist. Container-aware: when isolation
 *                  is "devcontainer", apt/dpkg/sudo drop to "allow" because they
 *                  only affect the container. When "host", they remain in "ask"
 *                  to force user approval.
 * - "full":        "allow" string root — total bypass. The wizard banners this.
 *
 * The per-agent permissions (agent.<id>.permission) override this root, so the
 * orchestrator's bash:deny stays intact.
 *
 * Reference: https://opencode.ai/docs/permissions
 */
export function buildOpenCodePermission(
  mode: PermissionMode,
  isolation: IsolationMode,
): unknown | undefined {
  if (mode === "strict") return undefined;
  if (mode === "full") {
    // Bug fix in 0.1.34: returning string "allow" was insufficient. OpenCode
    // v1.14.x has hardcoded confirmation prompts for state-changing git
    // operations (`git checkout -b`, `git commit`, `git push`, etc.) that
    // bypass the simple string permission. The user got "vuelve a pedir
    // permisos" despite picking `full`. Returning an explicit pattern object
    // overrides those prompts. Destructive ops (force push, hard reset, rm
    // -rf, sudo) stay in `ask` for safety even in full mode — full bypass of
    // those is too risky to enable by default.
    return {
      bash: {
        "*": "allow",
        "git *": "allow",
        "git push *": "allow",
        "git push --force *": "ask",
        "git push -f *": "ask",
        "git reset --hard *": "ask",
        "rm -rf *": "ask",
        "sudo *": "ask",
      },
      edit: "allow",
      read: "allow",
      glob: "allow",
      grep: "allow",
      webfetch: "allow",
      external_directory: "allow",
    };
  }

  // recommended
  const insideContainer = isolation === "devcontainer";
  return {
    bash: {
      "*": "ask",
      // Common dev commands — safe to allow
      "git *": "allow",
      "npm *": "allow",
      "pnpm *": "allow",
      "yarn *": "allow",
      "bun *": "allow",
      "mvn *": "allow",
      "gradle *": "allow",
      "pip *": "allow",
      "pipx *": "allow",
      "uv *": "allow",
      "python *": "allow",
      "python3 *": "allow",
      "node *": "allow",
      "go *": "allow",
      "cargo *": "allow",
      "dotnet *": "allow",
      "flutter *": "allow",
      "dart *": "allow",
      "docker *": "allow",
      "docker-compose *": "allow",
      "compose *": "allow",
      "make *": "allow",
      "cat *": "allow",
      "ls *": "allow",
      "pwd": "allow",
      "echo *": "allow",
      "grep *": "allow",
      "find *": "allow",
      "head *": "allow",
      "tail *": "allow",
      "wc *": "allow",
      "which *": "allow",
      "command -v *": "allow",
      "test *": "allow",
      "[ *": "allow",
      // Version managers (host installs go here, never sudo apt)
      "sdk *": "allow",
      "nvm *": "allow",
      "pyenv *": "allow",
      "rbenv *": "allow",
      "asdf *": "allow",
      "rustup *": "allow",
      // Package managers — context-aware
      "apt *": insideContainer ? "allow" : "ask",
      "apt-get *": insideContainer ? "allow" : "ask",
      "dpkg *": insideContainer ? "allow" : "ask",
      "brew *": insideContainer ? "allow" : "ask",
      "yum *": insideContainer ? "allow" : "ask",
      "dnf *": insideContainer ? "allow" : "ask",
      "apk *": insideContainer ? "allow" : "ask",
      // sudo escalates ALWAYS via ask, except inside container where it's a no-op risk
      "sudo *": insideContainer ? "allow" : "ask",
      // Destructive — explicit ask or deny
      "rm *": "ask",
      "rm -rf *": "ask",
      "git push --force *": "deny",
      "git push -f *": "deny",
      "git reset --hard *": "ask",
      "chmod 777 *": "deny",
      "chmod -R 777 *": "deny",
      // Specific block from the real incident: never touch system lockfiles or /etc, /var, /usr
      "rm /var/* *": "deny",
      "rm /etc/* *": "deny",
      "rm /usr/* *": "deny",
      "rm /var/lib/dpkg/* *": "deny",
      // Shell injection risk
      "curl * | sh": "deny",
      "curl * | bash": "deny",
      "wget * | sh": "deny",
      "wget * | bash": "deny",
    },
    // *.env stays denied by default (OpenCode built-in), no need to override.
    // Web access: ask by default — user wants to know if an agent goes online.
    webfetch: "ask",
    websearch: "allow",
    // External directory access (outside the workspace) — always ask.
    external_directory: "ask",
  };
}

/**
 * Adjust a per-agent permission map according to the project permission mode.
 *
 * Why this exists (bug fixed in 0.1.31):
 * `buildOpenCodePermission()` returns the ROOT permission of opencode.json.
 * In `full` mode the root is `"allow"`. But OpenCode's per-agent permission
 * (`agent.<id>.permission`) **overrides** the root, so each agent kept the
 * defaults from its role YAML — typically `bash: ask`, `webfetch: ask`,
 * `glob: deny`, etc. Result: user picked `full` but still got approval
 * prompts because per-agent overrides leaked through.
 *
 * Behaviour:
 * - `full`:        elevate every `ask` to `allow`. Preserve `deny` so the
 *                  orchestrator (coordinator-only by design) keeps its
 *                  `read: deny`/`bash: deny`/etc. intact.
 * - `recommended`: pass-through. Defaults from role YAML stay as they are.
 * - `strict`:      demote every `allow` to `ask`. Preserve `deny`. Most
 *                  conservative — every agent action requires confirmation.
 */
export function applyModeToAgentPermissions(
  perms: Record<string, string | boolean | undefined> | undefined,
  mode: PermissionMode,
): Record<string, string | boolean | undefined> | undefined {
  if (!perms) return perms;
  if (mode === "recommended") return perms;
  const out: Record<string, string | boolean | undefined> = { ...perms };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value === "deny") continue; // architectural — preserve always
    if (mode === "full" && value === "ask") out[key] = "allow";
    else if (mode === "strict" && value === "allow") out[key] = "ask";
  }
  return out;
}
