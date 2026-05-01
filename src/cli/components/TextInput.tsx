import { Box, Text } from "ink";
import InkTextInput from "ink-text-input";
import { useState } from "react";

interface Props {
  label: string;
  initialValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

export function TextInput({
  label,
  initialValue = "",
  placeholder,
  validate,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (v: string) => {
    const err = validate ? validate(v) : null;
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(v);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text bold>{label}</Text>
      </Box>
      <Box marginLeft={2}>
        <InkTextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder ?? ""}
        />
      </Box>
      {error && (
        <Box marginLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
