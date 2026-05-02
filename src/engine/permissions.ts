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
  if (mode === "full") return "allow";

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
