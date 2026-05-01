import { Box, Text } from "ink";

interface Props {
  step: number;
  total: number;
  title: string;
}

export function StepHeader({ step, total, title }: Props) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text dimColor>── </Text>
        <Text bold color="cyan">
          Paso {step}/{total}
        </Text>
        <Text dimColor>: </Text>
        <Text bold>{title}</Text>
        <Text dimColor> ──</Text>
      </Box>
    </Box>
  );
}
