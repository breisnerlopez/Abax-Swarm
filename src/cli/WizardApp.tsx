import { Box, Text, useApp } from "ink";
import { useState, useEffect, useMemo } from "react";
import { resolve, basename } from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { parse as yamlParse } from "yaml";
import type {
  ProjectConfig,
  DataContext,
  SelectionResult,
  TargetPlatform,
  TeamScope,
} from "../engine/types.js";
import type { ProjectSize } from "../loader/schemas.js";
import { runSelection, runPipeline, writePipeline } from "./pipeline.js";
import type { PipelineResult } from "./pipeline.js";
import { resolveDependencies } from "../engine/dependency-resolver.js";
import { Header } from "./components/Header.js";
import { StepHeader } from "./components/StepHeader.js";
import { TextInput } from "./components/TextInput.js";
import { SelectInput } from "./components/SelectInput.js";
import { MultiSelectInput } from "./components/MultiSelectInput.js";
import { ConfirmInput } from "./components/ConfirmInput.js";
import { Spinner } from "./components/Spinner.js";
import { InfoBox } from "./components/InfoBox.js";
import { RoleEditor } from "./components/RoleEditor.js";

interface ExistingManifest {
  project: { name: string; description?: string; size: ProjectSize; stack: string };
  team?: { roles?: Array<{ id: string }> };
  criteria_applied?: string[];
}

type StepName =
  | "target-dir"
  | "existing-confirm"
  | "platform"
  | "description"
  | "size"
  | "criteria"
  | "stack"
  | "role-scope"
  | "role-edit"
  | "confirm"
  | "generating"
  | "post-launch"
  | "done"
  | "cancelled";

interface WizardData {
  rawPath?: string;
  targetDir?: string;
  existing?: ExistingManifest | null;
  target?: TargetPlatform;
  description?: string;
  size?: ProjectSize;
  criteria?: string[];
  stackId?: string;
  scope?: TeamScope;
  selection?: SelectionResult;
  generated?: PipelineResult;
  generationError?: string;
  finalMessage?: string;
}

interface Props {
  ctx: DataContext;
  options: { dryRun: boolean };
}

const TOTAL_STEPS = 7;

function loadExistingManifest(targetDir: string): ExistingManifest | null {
  const manifestPath = resolve(targetDir, "project-manifest.yaml");
  if (!existsSync(manifestPath)) return null;
  try {
    return yamlParse(readFileSync(manifestPath, "utf-8")) as ExistingManifest;
  } catch {
    return null;
  }
}

export function WizardApp({ ctx, options }: Props) {
  const { exit } = useApp();
  const [step, setStep] = useState<StepName>("target-dir");
  const [data, setData] = useState<WizardData>({});

  // Auto-exit when reaching terminal states
  useEffect(() => {
    if (step === "done" || step === "cancelled") {
      const t = setTimeout(() => exit(), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step, exit]);

  // Run generation when entering "generating" step
  useEffect(() => {
    if (step !== "generating" || !data.selection) return;
    const config = buildConfig(data);
    const result = runPipeline(config, data.selection, ctx);
    if (options.dryRun) {
      setData((d) => ({
        ...d,
        generated: result,
        finalMessage: `Modo dry-run: ${result.files.length} archivos se generarían. Ejecuta sin --dry-run para escribir.`,
      }));
      setStep("done");
      return;
    }
    // async tick so spinner has a chance to render
    const t = setTimeout(() => {
      try {
        writePipeline(result, false);
        setData((d) => ({
          ...d,
          generated: result,
          finalMessage: `${result.files.length} archivos escritos en ${config.targetDir}`,
        }));
        setStep("post-launch");
      } catch (err) {
        setData((d) => ({ ...d, generationError: (err as Error).message }));
        setStep("cancelled");
      }
    }, 100);
    return () => clearTimeout(t);
  }, [step, data, ctx, options]);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header />
      {renderStep(step, data, setData, setStep, ctx, options)}
    </Box>
  );
}

function buildConfig(data: WizardData): ProjectConfig {
  const targetDir = data.targetDir!;
  return {
    name: data.existing?.project.name ?? basename(targetDir),
    description: data.description ?? `Proyecto ${basename(targetDir)}`,
    targetDir,
    size: data.size!,
    criteria: data.criteria ?? [],
    stackId: data.stackId!,
    target: data.target!,
    teamScope: data.scope ?? "full",
  };
}

function renderStep(
  step: StepName,
  data: WizardData,
  setData: (fn: (d: WizardData) => WizardData) => void,
  setStep: (s: StepName) => void,
  ctx: DataContext,
  options: { dryRun: boolean },
) {
  switch (step) {
    case "target-dir":
      return (
        <Box flexDirection="column">
          <StepHeader step={1} total={TOTAL_STEPS} title="Directorio del proyecto" />
          <TextInput
            label="Ruta del proyecto destino:"
            placeholder="/ruta/a/mi/proyecto"
            validate={(v) => (!v.trim() ? "Debes ingresar una ruta" : null)}
            onSubmit={(rawPath) => {
              const targetDir = resolve(rawPath);
              if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
              const existing = loadExistingManifest(targetDir);
              setData((d) => ({ ...d, rawPath, targetDir, existing }));
              setStep(existing ? "existing-confirm" : "platform");
            }}
          />
        </Box>
      );

    case "existing-confirm": {
      const ex = data.existing!;
      return (
        <Box flexDirection="column">
          <InfoBox title="⚠ Configuración existente detectada" color="yellow">
            <Text>Proyecto: <Text bold>{ex.project.name}</Text></Text>
            <Text>Tamaño:   {ex.project.size}</Text>
            <Text>Stack:    {ex.project.stack}</Text>
            {ex.team?.roles?.length ? (
              <Text dimColor>Roles: {ex.team.roles.length}</Text>
            ) : null}
            <Text color="yellow">
              Los archivos serán sobrescritos con la nueva configuración.
            </Text>
          </InfoBox>
          <ConfirmInput
            label="¿Deseas actualizar esta configuración?"
            defaultValue={true}
            onSubmit={(yes) => {
              if (!yes) {
                setData((d) => ({ ...d, finalMessage: "Cancelado." }));
                setStep("cancelled");
              } else {
                setStep("platform");
              }
            }}
          />
        </Box>
      );
    }

    case "platform":
      return (
        <Box flexDirection="column">
          <StepHeader step={2} total={TOTAL_STEPS} title="Plataforma destino" />
          <SelectInput<TargetPlatform>
            label="Plataforma de agentes:"
            options={[
              { label: "OpenCode", value: "opencode" },
              { label: "Claude Code", value: "claude" },
            ]}
            onSubmit={(target) => {
              setData((d) => ({ ...d, target }));
              setStep("description");
            }}
          />
        </Box>
      );

    case "description": {
      const name = data.existing?.project.name ?? basename(data.targetDir!);
      const defaultDesc = data.existing?.project.description ?? `Proyecto ${name}`;
      return (
        <Box flexDirection="column">
          <StepHeader step={3} total={TOTAL_STEPS} title="Información del proyecto" />
          <Box marginBottom={1}>
            <Text>Proyecto: <Text bold>{name}</Text></Text>
          </Box>
          <TextInput
            label="Descripción breve:"
            initialValue={defaultDesc}
            onSubmit={(description) => {
              setData((d) => ({ ...d, description: description || defaultDesc }));
              setStep("size");
            }}
          />
        </Box>
      );
    }

    case "size":
      return (
        <Box flexDirection="column">
          <StepHeader step={4} total={TOTAL_STEPS} title="Clasificación del proyecto" />
          <SelectInput<ProjectSize>
            label="Tamaño del proyecto:"
            options={[
              { label: "Pequeño (3-6 personas, < 6 meses)", value: "small" },
              { label: "Mediano (7-15 personas, 6-12 meses)", value: "medium" },
              { label: "Grande (15+ personas, > 12 meses)", value: "large" },
            ]}
            onSubmit={(size) => {
              setData((d) => ({ ...d, size }));
              setStep("criteria");
            }}
          />
        </Box>
      );

    case "criteria": {
      const opts = ctx.criteria.criteria.map((c) => ({
        label: c.question,
        value: c.id,
      }));
      return (
        <Box flexDirection="column">
          <StepHeader step={4} total={TOTAL_STEPS} title="Características del proyecto" />
          <MultiSelectInput<string>
            label="Selecciona las que apliquen:"
            options={opts}
            onSubmit={(criteria) => {
              setData((d) => ({ ...d, criteria }));
              setStep("stack");
            }}
          />
        </Box>
      );
    }

    case "stack": {
      const opts = Array.from(ctx.stacks.values()).map((s) => ({
        label: `${s.name} (${s.frontend?.framework ?? "N/A"} + ${s.backend?.framework ?? "N/A"})`,
        value: s.id,
      }));
      return (
        <Box flexDirection="column">
          <StepHeader step={5} total={TOTAL_STEPS} title="Selección de stack tecnológico" />
          <SelectInput<string>
            label="Stack tecnológico:"
            options={opts}
            onSubmit={(stackId) => {
              setData((d) => ({ ...d, stackId }));
              setStep("role-scope");
            }}
          />
        </Box>
      );
    }

    case "role-scope":
      return (
        <Box flexDirection="column">
          <StepHeader step={6} total={TOTAL_STEPS} title="Revisión de equipo — alcance" />
          <SelectInput<TeamScope>
            label="¿Qué roles incluir?"
            options={[
              { label: "Todos (indispensables + recomendados + criterios)", value: "full" },
              { label: "Solo indispensables (+ criterios)", value: "lean" },
            ]}
            onSubmit={(scope) => {
              const cfg = { ...buildConfig(data), teamScope: scope };
              const sel = runSelection(cfg, ctx);
              // merge previously configured roles from existing manifest
              if (data.existing?.team?.roles) {
                const currentIds = new Set(sel.roles.map((s) => s.roleId));
                for (const prev of data.existing.team.roles) {
                  if (!currentIds.has(prev.id) && ctx.roles.has(prev.id)) {
                    sel.roles.push({ roleId: prev.id, reason: "manual", removable: true });
                    currentIds.add(prev.id);
                  }
                }
              }
              setData((d) => ({ ...d, scope, selection: sel }));
              setStep("role-edit");
            }}
          />
        </Box>
      );

    case "role-edit": {
      const sel = data.selection!;
      const roleDetails = sel.roles.map((s) => {
        const role = ctx.roles.get(s.roleId);
        return {
          id: s.roleId,
          name: role?.name ?? s.roleId,
          reason: s.reason,
          removable: s.removable,
        };
      });
      const availableRoles = Array.from(ctx.roles.values())
        .filter((r) => r.id !== "orchestrator" && r.id !== "system-designer")
        .map((r) => ({ id: r.id, name: r.name, category: r.category, tier: String(r.tier) }));

      return (
        <Box flexDirection="column">
          <StepHeader step={6} total={TOTAL_STEPS} title="Revisión de equipo — edición" />
          <RoleEditor
            roles={roleDetails}
            availableRoles={availableRoles}
            onSubmit={(finalRoleIds) => {
              const selectedSet = new Set(finalRoleIds);
              const keptSelections = sel.roles.filter((s) => selectedSet.has(s.roleId));
              const originalIds = new Set(sel.roles.map((s) => s.roleId));
              for (const roleId of finalRoleIds) {
                if (!originalIds.has(roleId)) {
                  keptSelections.push({ roleId, reason: "manual", removable: true });
                }
              }
              const { selections: resolved, warnings } = resolveDependencies(
                keptSelections,
                ctx.dependencies,
              );
              setData((d) => ({
                ...d,
                selection: {
                  roles: resolved,
                  warnings: [...sel.warnings, ...warnings],
                  governanceModel: sel.governanceModel,
                },
              }));
              setStep("confirm");
            }}
          />
        </Box>
      );
    }

    case "confirm":
      return <ConfirmStep data={data} setStep={setStep} options={options} ctx={ctx} />;

    case "generating":
      return (
        <Box flexDirection="column" marginTop={1}>
          <Spinner label="Generando archivos…" />
        </Box>
      );

    case "post-launch": {
      const cliName =
        data.target === "claude" ? "Claude Code" : "OpenCode (orquestador)";
      const cli = data.target === "claude" ? "claude" : "opencode --agent orchestrator";
      return (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green" bold>
              ✓ Proyecto generado exitosamente
            </Text>
          </Box>
          {data.finalMessage && (
            <Box marginBottom={1}>
              <Text dimColor>{data.finalMessage}</Text>
            </Box>
          )}
          <ConfirmInput
            label={`¿Abrir ${cliName} en ${data.targetDir}?`}
            defaultValue={false}
            onSubmit={(yes) => {
              if (yes) {
                try {
                  execSync(
                    `start powershell -NoExit -Command "cd '${data.targetDir}'; ${cli}"`,
                    { stdio: "ignore" },
                  );
                } catch {
                  // silently ignore on non-Windows or if it fails
                }
              }
              setStep("done");
            }}
          />
        </Box>
      );
    }

    case "done":
      return (
        <Box marginTop={1}>
          <Text color="green">
            {data.finalMessage ?? "Listo."}
          </Text>
        </Box>
      );

    case "cancelled":
      return (
        <Box marginTop={1}>
          <Text color={data.generationError ? "red" : "yellow"}>
            {data.generationError
              ? `Error: ${data.generationError}`
              : (data.finalMessage ?? "Cancelado.")}
          </Text>
        </Box>
      );
  }
}

function ConfirmStep({
  data,
  setStep,
  options,
  ctx,
}: {
  data: WizardData;
  setStep: (s: StepName) => void;
  options: { dryRun: boolean };
  ctx: DataContext;
}) {
  const result = useMemo(() => {
    const config = buildConfig(data);
    return runPipeline(config, data.selection!, ctx);
  }, [data, ctx]);

  const filesByDir = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const f of result.files) {
      const dir = f.path.split("/").slice(0, -1).join("/") || ".";
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(f.path.split("/").pop()!);
    }
    return groups;
  }, [result]);

  const isUpdate = existsSync(resolve(data.targetDir!, "project-manifest.yaml"));
  const confirmMsg = options.dryRun
    ? "(dry-run) ¿Continuar para mostrar resumen?"
    : isUpdate
      ? "¿Actualizar archivos existentes?"
      : "¿Generar archivos?";

  return (
    <Box flexDirection="column">
      <StepHeader step={7} total={TOTAL_STEPS} title="Confirmación y generación" />
      <Box marginBottom={1}>
        <Text bold>Archivos a generar ({result.files.length}):</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {Array.from(filesByDir).map(([dir, files]) => (
          <Box flexDirection="column" key={dir}>
            <Text color="cyan">{dir}/</Text>
            {files.slice(0, 6).map((f) => (
              <Text dimColor key={f}>
                {"  ├─ "}
                {f}
              </Text>
            ))}
            {files.length > 6 && (
              <Text dimColor>
                {"  └─ … y "}
                {files.length - 6} más
              </Text>
            )}
          </Box>
        ))}
      </Box>
      {result.orchestratorWarnings.length > 0 && (
        <InfoBox title="Advertencias del orquestador" color="yellow">
          {result.orchestratorWarnings.map((w, i) => (
            <Text key={i} color="yellow">
              ⚠ {w}
            </Text>
          ))}
        </InfoBox>
      )}
      <ConfirmInput
        label={confirmMsg}
        defaultValue={true}
        onSubmit={(yes) => {
          if (!yes) {
            setStep("cancelled");
            return;
          }
          setStep("generating");
        }}
      />
    </Box>
  );
}
