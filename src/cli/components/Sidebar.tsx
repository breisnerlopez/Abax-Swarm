import { Box, Text } from "ink";

export interface SidebarItem {
  label: string;
  value: string | null;
}

interface Props {
  items: SidebarItem[];
}

export function Sidebar({ items }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      width={32}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Resumen
        </Text>
      </Box>
      {items.map((it, i) => {
        const filled = it.value !== null;
        return (
          <Box key={i} flexDirection="column">
            <Box>
              <Text color={filled ? "green" : "gray"}>
                {filled ? "● " : "○ "}
              </Text>
              <Text bold={filled} color={filled ? undefined : "gray"}>
                {it.label}
              </Text>
            </Box>
            {filled && it.value && (
              <Box marginLeft={2}>
                <Text dimColor wrap="truncate">
                  {it.value}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
