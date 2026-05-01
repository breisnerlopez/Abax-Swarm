import { Box, Text } from "ink";
import InkSelectInput from "ink-select-input";

export interface Option<T> {
  label: string;
  value: T;
  description?: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  onSubmit: (value: T) => void;
}

export function SelectInput<T>({ label, options, onSubmit }: Props<T>) {
  const items = options.map((o, i) => ({
    label: o.label,
    value: String(i),
    key: String(i),
  }));

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text bold>{label}</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <InkSelectInput
          items={items}
          onSelect={(item) => {
            const idx = Number(item.value);
            onSubmit(options[idx]!.value);
          }}
        />
      </Box>
    </Box>
  );
}
