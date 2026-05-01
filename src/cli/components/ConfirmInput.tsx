import { Box, Text, useInput } from "ink";

interface Props {
  label: string;
  defaultValue?: boolean;
  onSubmit: (value: boolean) => void;
}

export function ConfirmInput({ label, defaultValue = true, onSubmit }: Props) {
  useInput((input, key) => {
    const lower = input.toLowerCase();
    if (lower === "y" || lower === "s") {
      onSubmit(true);
    } else if (lower === "n") {
      onSubmit(false);
    } else if (key.return) {
      onSubmit(defaultValue);
    }
  });

  const hint = defaultValue ? "[Y/n]" : "[y/N]";

  return (
    <Box>
      <Text color="cyan">{"> "}</Text>
      <Text bold>{label}</Text>
      <Text dimColor> {hint}</Text>
    </Box>
  );
}
