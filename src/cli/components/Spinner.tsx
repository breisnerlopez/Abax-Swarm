import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";

interface Props {
  label: string;
}

export function Spinner({ label }: Props) {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
}
