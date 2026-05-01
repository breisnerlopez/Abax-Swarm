import { Box, Text } from "ink";

interface Props {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: Props) {
  return (
    <Box marginBottom={1}>
      <Text>{"  "}</Text>
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        let color: "green" | "cyan" | "gray" | undefined;
        let symbol = "○";
        if (idx < current) {
          symbol = "●";
          color = "green";
        } else if (idx === current) {
          symbol = "●";
          color = "cyan";
        } else {
          color = "gray";
        }
        return (
          <Text key={idx} color={color}>
            {symbol}
            {idx < total ? "─" : ""}
          </Text>
        );
      })}
      <Text dimColor>
        {"  Paso "}
        {Math.min(current, total)}
        {" de "}
        {total}
      </Text>
    </Box>
  );
}
