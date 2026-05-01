import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface Props {
  title?: string;
  color?: "yellow" | "red" | "green" | "cyan" | "magenta";
  children: ReactNode;
}

export function InfoBox({ title, color = "yellow", children }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      marginY={1}
    >
      {title && (
        <Box marginBottom={1}>
          <Text bold color={color}>
            {title}
          </Text>
        </Box>
      )}
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}
