import { Box, Text, useInput } from "ink";
import { useState } from "react";

export interface MultiOption<T> {
  label: string;
  value: T;
}

interface Props<T> {
  label: string;
  options: MultiOption<T>[];
  onSubmit: (values: T[]) => void;
}

export function MultiSelectInput<T>({ label, options, onSubmit }: Props<T>) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c - 1 + options.length) % options.length);
    } else if (key.downArrow) {
      setCursor((c) => (c + 1) % options.length);
    } else if (input === " ") {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(cursor)) next.delete(cursor);
        else next.add(cursor);
        return next;
      });
    } else if (input.toLowerCase() === "a") {
      setSelected(new Set(options.map((_, i) => i)));
    } else if (input.toLowerCase() === "n") {
      setSelected(new Set());
    } else if (key.return) {
      const values = Array.from(selected)
        .sort((a, b) => a - b)
        .map((i) => options[i]!.value);
      onSubmit(values);
    }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text bold>{label}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor>
          [Space] toggle · [A] todos · [N] ninguno · [Enter] confirmar
        </Text>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {options.map((opt, i) => {
          const isSelected = selected.has(i);
          const isCursor = i === cursor;
          const checkbox = isSelected ? "[x]" : "[ ]";
          return (
            <Box key={i}>
              <Text color={isCursor ? "cyan" : undefined}>
                {isCursor ? "› " : "  "}
              </Text>
              <Text color={isSelected ? "green" : undefined}>{checkbox}</Text>
              <Text color={isCursor ? "cyan" : undefined}> {opt.label}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>
          {selected.size} seleccionados de {options.length}
        </Text>
      </Box>
    </Box>
  );
}
