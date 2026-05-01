import { Box, Text, useInput } from "ink";
import { useState, useMemo } from "react";

export interface RoleEntry {
  id: string;
  name: string;
  reason: string;
  removable: boolean;
}

export interface AvailableRole {
  id: string;
  name: string;
  category: string;
  tier: string;
}

interface Props {
  roles: RoleEntry[];
  availableRoles: AvailableRole[];
  onSubmit: (finalRoleIds: string[]) => void;
}

type Mode = "list" | "remove" | "add";

const reasonLabel = (reason: string): { label: string; color?: string } => {
  switch (reason) {
    case "indispensable":
      return { label: "indispensable", color: "green" };
    case "recommended":
      return { label: "recomendado", color: "cyan" };
    case "criteria":
      return { label: "criterio", color: "magenta" };
    case "dependency":
      return { label: "dependencia", color: "yellow" };
    case "manual":
      return { label: "manual", color: "gray" };
    default:
      return { label: reason };
  }
};

export function RoleEditor({ roles, availableRoles, onSubmit }: Props) {
  const initial = useMemo(() => {
    const m = new Map<string, RoleEntry>();
    for (const r of roles) m.set(r.id, r);
    return m;
  }, [roles]);

  const [current, setCurrent] = useState<Map<string, RoleEntry>>(initial);
  const [mode, setMode] = useState<Mode>("list");
  const [cursor, setCursor] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const currentArr = Array.from(current.values());
  const availableNotSelected = availableRoles.filter((a) => !current.has(a.id));
  const hasAvailable = availableNotSelected.length > 0;

  useInput((input, key) => {
    if (mode === "list") {
      const lower = input.toLowerCase();
      if (lower === "c" || key.return) {
        onSubmit(Array.from(current.keys()));
      } else if (lower === "q") {
        setMode("remove");
        setCursor(0);
        setMarked(new Set());
      } else if (lower === "a" && hasAvailable) {
        setMode("add");
        setCursor(0);
        setMarked(new Set());
      }
      return;
    }

    if (mode === "remove") {
      if (key.escape) {
        setMode("list");
        setMarked(new Set());
        return;
      }
      if (key.upArrow) {
        setCursor((c) => (c - 1 + currentArr.length) % currentArr.length);
      } else if (key.downArrow) {
        setCursor((c) => (c + 1) % currentArr.length);
      } else if (input === " ") {
        const id = currentArr[cursor]!.id;
        setMarked((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else if (key.return) {
        if (marked.size === 0) {
          setMode("list");
          return;
        }
        setCurrent((prev) => {
          const next = new Map(prev);
          for (const id of marked) next.delete(id);
          return next;
        });
        setMode("list");
        setMarked(new Set());
      }
      return;
    }

    if (mode === "add") {
      if (key.escape) {
        setMode("list");
        setMarked(new Set());
        return;
      }
      if (availableNotSelected.length === 0) {
        if (key.return || key.escape) setMode("list");
        return;
      }
      if (key.upArrow) {
        setCursor(
          (c) => (c - 1 + availableNotSelected.length) % availableNotSelected.length,
        );
      } else if (key.downArrow) {
        setCursor((c) => (c + 1) % availableNotSelected.length);
      } else if (input === " ") {
        const id = availableNotSelected[cursor]!.id;
        setMarked((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else if (key.return) {
        if (marked.size === 0) {
          setMode("list");
          return;
        }
        setCurrent((prev) => {
          const next = new Map(prev);
          for (const id of marked) {
            const r = availableNotSelected.find((a) => a.id === id);
            if (r) {
              next.set(r.id, {
                id: r.id,
                name: r.name,
                reason: "manual",
                removable: true,
              });
            }
          }
          return next;
        });
        setMode("list");
        setMarked(new Set());
      }
    }
  });

  if (mode === "list") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">{"> "}</Text>
          <Text bold>Equipo actual ({current.size} roles):</Text>
        </Box>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {currentArr.map((r) => {
            const { label, color } = reasonLabel(r.reason);
            return (
              <Box key={r.id}>
                <Text>· {r.name}  </Text>
                <Text color={color} dimColor={!color}>
                  ({label})
                </Text>
              </Box>
            );
          })}
        </Box>
        <Box marginLeft={2} marginTop={1}>
          <Text dimColor>
            [Q] quitar · {hasAvailable ? "[A] agregar · " : ""}[C/Enter] continuar
          </Text>
        </Box>
      </Box>
    );
  }

  if (mode === "remove") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">{"> "}</Text>
          <Text bold>Marca roles a quitar:</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>
            [Space] marcar · [Enter] confirmar · [Esc] cancelar
          </Text>
        </Box>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {currentArr.map((r, i) => {
            const isMarked = marked.has(r.id);
            const isCursor = i === cursor;
            const warn = !r.removable ? " ⚠ indispensable" : "";
            return (
              <Box key={r.id}>
                <Text color={isCursor ? "cyan" : undefined}>
                  {isCursor ? "› " : "  "}
                </Text>
                <Text color={isMarked ? "red" : undefined}>
                  {isMarked ? "[x]" : "[ ]"}
                </Text>
                <Text color={isCursor ? "cyan" : undefined}>
                  {" "}
                  {r.name}
                </Text>
                {warn && <Text color="yellow">{warn}</Text>}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  // mode === "add"
  if (availableNotSelected.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No hay roles adicionales disponibles.</Text>
        <Text dimColor>[Enter/Esc] volver</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text bold>Marca roles a agregar:</Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor>
          [Space] marcar · [Enter] confirmar · [Esc] cancelar
        </Text>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {availableNotSelected.map((r, i) => {
          const isMarked = marked.has(r.id);
          const isCursor = i === cursor;
          return (
            <Box key={r.id}>
              <Text color={isCursor ? "cyan" : undefined}>
                {isCursor ? "› " : "  "}
              </Text>
              <Text color={isMarked ? "green" : undefined}>
                {isMarked ? "[x]" : "[ ]"}
              </Text>
              <Text color={isCursor ? "cyan" : undefined}> {r.name} </Text>
              <Text dimColor>
                [{r.category}, tier {r.tier}]
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
