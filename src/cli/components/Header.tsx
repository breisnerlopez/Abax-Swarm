import { Box, Text } from "ink";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Read version from package.json so the banner stays in sync with the published
// version. Both `dist/cli/components/Header.js` and the source live two levels
// deep relative to package.json (../.. and ../../.. respectively); this resolves
// from `import.meta.url` and walks up until a package.json is found.
function readPackageVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf-8")) as { version?: string; name?: string };
      if (pkg.name === "abax-swarm" && typeof pkg.version === "string") return pkg.version;
    } catch {
      // not here, walk up
    }
    dir = resolve(dir, "..");
  }
  return "0.0.0";
}

const VERSION = readPackageVersion();

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={2}
        flexDirection="column"
      >
        <Text bold color="cyan">
          Abax Swarm · v{VERSION}
        </Text>
        <Text dimColor>AI Agent Orchestration for Software</Text>
      </Box>
    </Box>
  );
}
