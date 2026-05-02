import { Box, Text, useApp, useInput } from "ink";
import { useState, useEffect, useMemo, useCallback } from "react";
import { resolve, basename } from "path";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { parse as yamlParse } from "yaml";
import type {
  ProjectConfig,
  DataContext,
  ModelStrategy,
  SelectionResult,
  TargetPlatform,
  TeamScope,
} from "../engine/types.js";
import type { ProjectSize } from "../loader/schemas.js";
import { runSelection, runPipeline, writePipeline } from "./pipeline.js";
import type { PipelineResult } from "./pipeline.js";
import { resolveDependencies } from "../engine/dependency-resolver.js";
import { buildModelMix, groupMixBySpec } from "../engine/model-mapping.js";
import { Header } from "./components/Header.js";
import { StepHeader } from "./components/StepHeader.js";
import { TextInput } from "./components/TextInput.js";
import { SelectInput } from "./components/SelectInput.js";
import { MultiSelectInput } from "./components/MultiSelectInput.js";
import { ConfirmInput } from "./components/ConfirmInput.js";
import { Spinner } from "./components/Spinner.js";
import { InfoBox } from "./components/InfoBox.js";
import { RoleEditor } from "./components/RoleEditor.js";
import { ProgressBar } from "./components/ProgressBar.js";
import { Sidebar } from "./components/Sidebar.js";
import type { SidebarItem } from "./components/Sidebar.js";

interface ExistingManifest {
  project: {
    name: string;
    description?: string;
    size: ProjectSize;
    stack: string;
    target?: TargetPlatform;
    provider?: "anthropic" | "openai";
    model_strategy?: ModelStrategy;
  };
  team?: { roles?: Array<{ id: string }> };
  criteria_applied?: string[];
}

type StepName =
  | "target-dir"
  | "existing-confirm"
  | "platform"
  | "model-strategy"
  | "provider"
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
  provider?: "anthropic" | "openai";
  modelStrategy?: ModelStrategy;
  modelOverrides?: Record<string, { cognitive_tier?: "strategic" | "implementation" | "mechanical"; reasoning?: "none" | "low" | "medium" | "high" }>;
  selection?: SelectionResult;
  generated?: PipelineResult;
  generationError?: string;
  finalMessage?: string;
}

interface Props {
  ctx: DataContext;
  options: { dryRun: boolean };
}

const TOTAL_STEPS = 8;

function loadExistingManifest(targetDir: string): ExistingManifest | null {
  const manifestPath = resolve(targetDir, "project-manifest.yaml");
  if (!existsSync(manifestPath)) return null;
  try {
    return yamlParse(readFileSync(manifestPath, "utf-8")) as ExistingManifest;
  } catch {
    return null;
  }
}

function stepNumber(step: StepName): number | null {
  switch (step) {
    case "target-dir":
    case "existing-confirm":
      return 1;
    case "platform":
      return 2;
    case "model-strategy":
    case "provider":
      return 3;
    case "description":
      return 4;
    case "size":
    case "criteria":
      return 5;
    case "stack":
      return 6;
    case "role-scope":
    case "role-edit":
      return 7;
    case "confirm":
      return 8;
    default:
      return null;
  }
}

const SIZE_LABELS: Record<ProjectSize, string> = {
  small: "Pequeño",
  medium: "Mediano",
  large: "Grande",
};

function buildSidebarItems(data: WizardData, ctx: DataContext): SidebarItem[] {
  return [
    { label: "Directorio", value: data.targetDir ?? null },
    {
      label: "Plataforma",
      value: data.target
        ? data.target === "opencode"
          ? "OpenCode"
          : "Claude Code"
        : null,
    },
    {
      label: "Modelos",
      value: data.modelStrategy === "inherit"
        ? "heredados (default del usuario)"
        : data.provider
          ? data.provider === "anthropic"
            ? "Anthropic (Claude)"
            : "OpenAI (GPT)"
          : null,
    },
    { label: "Descripción", value: data.description ?? null },
    { label: "Tamaño", value: data.size ? SIZE_LABELS[data.size] : null },
    {
      label: "Criterios",
      value: data.criteria
        ? data.criteria.length === 0
          ? "ninguno"
          : `${data.criteria.length} seleccionados`
        : null,
    },
    {
      label: "Stack",
      value: data.stackId
        ? (ctx.stacks.get(data.stackId)?.name ?? data.stackId)
        : null,
    },
    {
      label: "Equipo",
      value: data.selection ? `${data.selection.roles.length} roles` : null,
    },
  ];
}

export function WizardApp({ ctx, options }: Props) {
  const { exit } = useApp();
  const [step, setStep] = useState<StepName>("target-dir");
  const [history, setHistory] = useState<StepName[]>([]);
  const [data, setData] = useState<WizardData>({});

  const go = useCallback(
    (next: StepName, pushHistory = true) => {
      if (pushHistory) setHistory((h) => [...h, step]);
      setStep(next);
    },
    [step],
  );

  const back = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setStep(prev);
      return h.slice(0, -1);
    });
  }, []);

  // Global Ctrl+B for back
  useInput((input, key) => {
    if (key.ctrl && input === "b" && history.length > 0) {
      // No back from terminal/transient steps
      if (
        step === "generating" ||
        step === "done" ||
        step === "cancelled" ||
        step === "post-launch"
      ) {
        return;
      }
      back();
    }
  });

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
      go("done", false);
      return;
    }
    const t = setTimeout(() => {
      try {
        writePipeline(result, false);
        setData((d) => ({
          ...d,
          generated: result,
          finalMessage: `${result.files.length} archivos escritos en ${config.targetDir}`,
        }));
        go("post-launch", false);
      } catch (err) {
        setData((d) => ({ ...d, generationError: (err as Error).message }));
        go("cancelled", false);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [step, data, ctx, options, go]);

  const stepNum = stepNumber(step);
  const showChrome = stepNum !== null;
  const showSidebar = showChrome && step !== "target-dir";
  const canGoBack =
    history.length > 0 &&
    step !== "generating" &&
    step !== "done" &&
    step !== "cancelled" &&
    step !== "post-launch";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header />
      {showChrome && stepNum !== null && (
        <ProgressBar current={stepNum} total={TOTAL_STEPS} />
      )}
      <Box flexDirection="row">
        <Box flexGrow={1} flexDirection="column">
          {renderStep(step, data, setData, go, ctx, options)}
        </Box>
        {showSidebar && (
          <Box marginLeft={2}>
            <Sidebar items={buildSidebarItems(data, ctx)} />
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {canGoBack ? "Ctrl+B volver  ·  " : ""}Ctrl+C salir
        </Text>
      </Box>
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
    provider: data.provider ?? "anthropic",
    modelStrategy: data.modelStrategy ?? "custom",
    modelOverrides: data.modelOverrides,
  };
}

function renderStep(
  step: StepName,
  data: WizardData,
  setData: (fn: (d: WizardData) => WizardData) => void,
  go: (next: StepName, pushHistory?: boolean) => void,
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
            initialValue={data.rawPath}
            placeholder="/ruta/a/mi/proyecto"
            validate={(v) => (!v.trim() ? "Debes ingresar una ruta" : null)}
            onSubmit={(rawPath) => {
              const targetDir = resolve(rawPath);
              if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
              const existing = loadExistingManifest(targetDir);
              setData((d) => ({
                ...d,
                rawPath,
                targetDir,
                existing,
                // Preload prior choices so "actualizar" defaults to what was used before.
                ...(existing
                  ? {
                      target: existing.project.target ?? d.target,
                      provider: existing.project.provider ?? d.provider,
                      modelStrategy: existing.project.model_strategy ?? d.modelStrategy,
                    }
                  : {}),
              }));
              go(existing ? "existing-confirm" : "platform");
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
            {ex.project.target ? <Text>Plataforma: {ex.project.target}</Text> : null}
            {ex.project.model_strategy ? (
              <Text>
                Modelos:  {ex.project.model_strategy}
                {ex.project.model_strategy === "custom" && ex.project.provider
                  ? ` (${ex.project.provider})`
                  : ""}
              </Text>
            ) : null}
            {ex.team?.roles?.length ? (
              <Text dimColor>Roles: {ex.team.roles.length}</Text>
            ) : null}
            <Text color="yellow">
              Los archivos serán sobrescritos. Tus elecciones previas vienen
              preseleccionadas en cada paso.
            </Text>
          </InfoBox>
          <ConfirmInput
            label="¿Deseas actualizar esta configuración?"
            defaultValue={true}
            onSubmit={(yes) => {
              if (!yes) {
                setData((d) => ({ ...d, finalMessage: "Cancelado." }));
                go("cancelled", false);
              } else {
                go("platform");
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
            initialValue={data.target}
            options={[
              { label: "OpenCode", value: "opencode" },
              { label: "Claude Code", value: "claude" },
            ]}
            onSubmit={(target) => {
              setData((d) => ({ ...d, target }));
              go("model-strategy");
            }}
          />
        </Box>
      );

    case "model-strategy":
      return (
        <Box flexDirection="column">
          <StepHeader step={3} total={TOTAL_STEPS} title="Asignación de modelos" />
          <Box marginBottom={1} flexDirection="column">
            <Text dimColor>
              Personalizado: cada rol recibe un modelo según su nivel cognitivo
              (estratégico / implementación / mecánico).
            </Text>
            <Text dimColor>
              Heredar: no se asigna modelo en los agentes; se usa el default de tu
              configuración local. Útil si no tienes acceso a Opus o GPT-5.
            </Text>
          </Box>
          <SelectInput<ModelStrategy>
            label="¿Cómo asignar modelos a los agentes?"
            initialValue={data.modelStrategy}
            options={[
              { label: "Personalizado por rol (recomendado)", value: "custom" },
              { label: "Heredar del default de mi configuración", value: "inherit" },
            ]}
            onSubmit={(modelStrategy) => {
              setData((d) => ({ ...d, modelStrategy }));
              go(modelStrategy === "inherit" ? "description" : "provider");
            }}
          />
        </Box>
      );

    case "provider":
      return (
        <Box flexDirection="column">
          <StepHeader step={3} total={TOTAL_STEPS} title="Proveedor de IA" />
          <Box marginBottom={1}>
            <Text dimColor>
              Cada rol del equipo tendrá un modelo del mismo proveedor según su nivel
              cognitivo (estratégico / implementación / mecánico).
            </Text>
          </Box>
          <SelectInput<"anthropic" | "openai">
            label="¿Qué proveedor usarás?"
            initialValue={data.provider}
            options={[
              { label: "Anthropic (Claude opus / sonnet / haiku)", value: "anthropic" },
              { label: "OpenAI (GPT-5 / mini / nano)", value: "openai" },
            ]}
            onSubmit={(provider) => {
              setData((d) => ({ ...d, provider }));
              go("description");
            }}
          />
        </Box>
      );

    case "description": {
      const name = data.existing?.project.name ?? basename(data.targetDir!);
      const defaultDesc = data.existing?.project.description ?? `Proyecto ${name}`;
      return (
        <Box flexDirection="column">
          <StepHeader step={4} total={TOTAL_STEPS} title="Información del proyecto" />
          <Box marginBottom={1}>
            <Text>Proyecto: <Text bold>{name}</Text></Text>
          </Box>
          <TextInput
            label="Descripción breve:"
            initialValue={data.description ?? defaultDesc}
            onSubmit={(description) => {
              setData((d) => ({ ...d, description: description || defaultDesc }));
              go("size");
            }}
          />
        </Box>
      );
    }

    case "size":
      return (
        <Box flexDirection="column">
          <StepHeader step={5} total={TOTAL_STEPS} title="Clasificación del proyecto" />
          <SelectInput<ProjectSize>
            label="Tamaño del proyecto:"
            options={[
              { label: "Pequeño (3-6 personas, < 6 meses)", value: "small" },
              { label: "Mediano (7-15 personas, 6-12 meses)", value: "medium" },
              { label: "Grande (15+ personas, > 12 meses)", value: "large" },
            ]}
            onSubmit={(size) => {
              setData((d) => ({ ...d, size }));
              go("criteria");
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
          <StepHeader step={5} total={TOTAL_STEPS} title="Características del proyecto" />
          <MultiSelectInput<string>
            label="Selecciona las que apliquen:"
            options={opts}
            onSubmit={(criteria) => {
              setData((d) => ({ ...d, criteria }));
              go("stack");
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
          <StepHeader step={6} total={TOTAL_STEPS} title="Selección de stack tecnológico" />
          <SelectInput<string>
            label="Stack tecnológico:"
            options={opts}
            onSubmit={(stackId) => {
              setData((d) => ({ ...d, stackId }));
              go("role-scope");
            }}
          />
        </Box>
      );
    }

    case "role-scope":
      return (
        <Box flexDirection="column">
          <StepHeader step={7} total={TOTAL_STEPS} title="Revisión de equipo — alcance" />
          <SelectInput<TeamScope>
            label="¿Qué roles incluir?"
            options={[
              { label: "Todos (indispensables + recomendados + criterios)", value: "full" },
              { label: "Solo indispensables (+ criterios)", value: "lean" },
            ]}
            onSubmit={(scope) => {
              const cfg = { ...buildConfig(data), teamScope: scope };
              const sel = runSelection(cfg, ctx);
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
              go("role-edit");
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
          <StepHeader step={7} total={TOTAL_STEPS} title="Revisión de equipo — edición" />
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
              go("confirm");
            }}
          />
        </Box>
      );
    }

    case "confirm":
      return <ConfirmStep data={data} go={go} options={options} ctx={ctx} setData={setData} />;

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
          {data.generated && data.generated.files.length > 0 && (
            <Box flexDirection="column" marginBottom={1}>
              <Text bold>Archivos generados ({data.generated.files.length}):</Text>
              {data.generated.files.slice(0, 8).map((f) => (
                <Text dimColor key={f.path}>
                  · {f.path}
                </Text>
              ))}
              {data.generated.files.length > 8 && (
                <Text dimColor>… y {data.generated.files.length - 8} más</Text>
              )}
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
                  // ignore on non-Windows or if it fails
                }
              }
              go("done", false);
            }}
          />
        </Box>
      );
    }

    case "done":
      return (
        <Box marginTop={1}>
          <Text color="green">{data.finalMessage ?? "Listo."}</Text>
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
  go,
  options,
  ctx,
  setData,
}: {
  data: WizardData;
  go: (next: StepName, pushHistory?: boolean) => void;
  options: { dryRun: boolean };
  ctx: DataContext;
  setData: (fn: (d: WizardData) => WizardData) => void;
}) {
  const result = useMemo(() => {
    const config = buildConfig(data);
    return runPipeline(config, data.selection!, ctx);
  }, [data, ctx]);

  const mixGroups = useMemo(() => {
    if (data.modelStrategy === "inherit") return [];
    const provider = data.provider ?? "anthropic";
    const mix = buildModelMix(provider, result.project.roles, data.modelOverrides ?? {});
    return groupMixBySpec(mix);
  }, [data, result]);

  const filesByDir = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const f of result.files) {
      const dir = f.path.split("/").slice(0, -1).join("/") || ".";
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(f.path.split("/").pop()!);
    }
    return groups;
  }, [result]);

  const [showAllDirs, setShowAllDirs] = useState(false);
  useInput((input) => {
    if (input.toLowerCase() === "e") setShowAllDirs((v) => !v);
  });

  const isUpdate = existsSync(resolve(data.targetDir!, "project-manifest.yaml"));
  const confirmMsg = options.dryRun
    ? "(dry-run) ¿Continuar para mostrar resumen?"
    : isUpdate
      ? "¿Actualizar archivos existentes?"
      : "¿Generar archivos?";

  return (
    <Box flexDirection="column">
      <StepHeader step={8} total={TOTAL_STEPS} title="Confirmación y generación" />
      <Box marginBottom={1} flexDirection="column">
        {data.modelStrategy === "inherit" ? (
          <>
            <Text bold>Modelos:</Text>
            <Box marginLeft={2}>
              <Text dimColor>
                Heredados del default de tu configuración (no se escribirá `model:` en
                los agentes ni en opencode.json).
              </Text>
            </Box>
          </>
        ) : (
          <>
            <Text bold>
              Mix de modelos ({data.provider === "openai" ? "OpenAI" : "Anthropic"}):
            </Text>
            {mixGroups.map((g, i) => (
              <Box key={i} flexDirection="column" marginLeft={2}>
                <Text>
                  <Text color="cyan">{g.spec.model}</Text>
                  {g.spec.thinking ? (
                    <Text dimColor>
                      {" "}· thinking {g.spec.thinking.budgetTokens / 1000}k
                    </Text>
                  ) : null}
                  {g.spec.reasoningEffort ? (
                    <Text dimColor> · reasoning {g.spec.reasoningEffort}</Text>
                  ) : null}
                </Text>
                <Text dimColor>{"  "}{g.roleIds.join(", ")}</Text>
              </Box>
            ))}
          </>
        )}
      </Box>
      <Box marginBottom={1}>
        <Text bold>Archivos a generar ({result.files.length}):</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {(showAllDirs ? Array.from(filesByDir) : Array.from(filesByDir).slice(0, 8))
          .map(([dir, files]) => (
            <Box flexDirection="column" key={dir}>
              <Text color="cyan">{dir}/</Text>
              {(showAllDirs ? files : files.slice(0, 4)).map((f) => (
                <Text dimColor key={f}>
                  {"  ├─ "}
                  {f}
                </Text>
              ))}
              {!showAllDirs && files.length > 4 && (
                <Text dimColor>
                  {"  └─ … y "}
                  {files.length - 4} más
                </Text>
              )}
            </Box>
          ))}
        {!showAllDirs && filesByDir.size > 8 && (
          <Box marginTop={1}>
            <Text dimColor>
              … y {filesByDir.size - 8} directorios más con{" "}
              {result.files.length -
                Array.from(filesByDir)
                  .slice(0, 8)
                  .reduce((acc, [, fs]) => acc + fs.length, 0)}{" "}
              archivos · pulsa [E] para ver todo
            </Text>
          </Box>
        )}
        {showAllDirs && (
          <Box marginTop={1}>
            <Text dimColor>[E] colapsar</Text>
          </Box>
        )}
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
            setData((d) => ({ ...d, finalMessage: "Cancelado. No se modificaron archivos." }));
            go("cancelled", false);
            return;
          }
          go("generating");
        }}
      />
    </Box>
  );
}
