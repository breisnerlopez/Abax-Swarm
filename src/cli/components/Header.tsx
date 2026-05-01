import { Box, Text } from "ink";

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
          Abax Swarm · v0.1.1
        </Text>
        <Text dimColor>AI Agent Orchestration for Software</Text>
      </Box>
    </Box>
  );
}
