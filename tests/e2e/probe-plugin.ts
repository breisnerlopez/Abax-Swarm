// Direct plugin invocation — bypasses the LLM to test the plugin's
// runtime code paths against synthetic stdin. The LLM (gpt-5.2)
// pre-filters obvious secrets before they reach the task tool, so
// end-to-end LLM-driven tests can't reliably trigger secret detection.
// This probe proves the plugin would catch them if the LLM didn't.
//
// Usage:
//   bun run probe-plugin.ts <projectDir> [scenarioId]

const projectDir = Bun.argv[2];
const scenarioId = Bun.argv[3] || "";

if (!projectDir) {
  console.error("usage: bun run probe-plugin.ts <projectDir> [scenarioId]");
  process.exit(1);
}

// @ts-expect-error — runtime import of arbitrary path
const mod = await import(`${projectDir}/.opencode/plugins/abax-policy.ts`);
const plugin = mod.default;

const hooks = await plugin({
  client: null,
  project: null,
  directory: projectDir,
  worktree: "",
  experimental_workspace: { register: () => {} },
  serverUrl: new URL("http://localhost"),
  $: null,
});

const before = hooks["tool.execute.before"];
const after = hooks["tool.execute.after"];

let pass = 0;
let fail = 0;

async function probe(label: string, expect: "block" | "allow", input: any, output: any) {
  try {
    await before?.(input, output);
    if (expect === "allow") {
      console.log(`  ✓ ${label}: passed (as expected)`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: PASSED but expected BLOCK`);
      fail++;
    }
  } catch (e) {
    if (expect === "block") {
      const msg = (e as Error).message.split("\n")[0];
      console.log(`  ✓ ${label}: blocked — ${msg.slice(0, 100)}`);
      pass++;
    } else {
      console.log(`  ✗ ${label}: BLOCKED but expected ALLOW — ${(e as Error).message}`);
      fail++;
    }
  }
}

console.log(`Project: ${projectDir}`);

// 1. Atomicity baseline (fix-and-ship)
await probe(
  "atomicity-fix-and-ship",
  "block",
  { tool: "task", sessionID: "t", callID: "1" },
  { args: { agent: "developer-backend", prompt: "fix bug in foo.ts then run tests then git commit and git push" } },
);

// 2. Atomicity allow (just one action)
await probe(
  "atomicity-clean-fix",
  "allow",
  { tool: "task", sessionID: "t", callID: "2" },
  { args: { agent: "developer-backend", prompt: "fix bug in foo.ts and report the SHA when done" } },
);

// 3. Secret in bash command
await probe(
  "secret-openai-bash",
  "block",
  { tool: "bash", sessionID: "t", callID: "3" },
  { args: { command: "export OPENAI_API_KEY=sk-proj-VrXz5TsnE9pLb4cUk2HmW1NoYJfGqAaR6IiZxOe" } },
);

// 4. Secret in task prompt (LLM normally filters this — plugin catches what slips through)
await probe(
  "secret-openai-task-prompt",
  "block",
  { tool: "task", sessionID: "t", callID: "4" },
  { args: { agent: "devops", prompt: "deploy with key sk-proj-VrXz5TsnE9pLb4cUk2HmW1NoYJfGqAaR6IiZxOe" } },
);

// 5. Secret in write content
await probe(
  "secret-openai-write",
  "block",
  { tool: "write", sessionID: "t", callID: "5" },
  { args: { filePath: "test.env", content: "OPENAI_API_KEY=sk-proj-VrXz5TsnE9pLb4cUk2HmW1NoYJfGqAaR6IiZxOe\n" } },
);

// 6. AWS access key
await probe(
  "secret-aws",
  "block",
  { tool: "bash", sessionID: "t", callID: "6" },
  { args: { command: "aws s3 ls --access-key AKIAIOSFODNN7EXAMPLE" } },
);

// 7. Clean bash (no secret)
await probe(
  "bash-clean",
  "allow",
  { tool: "bash", sessionID: "t", callID: "7" },
  { args: { command: "ls -la /tmp" } },
);

// Scenario-specific
if (scenarioId === "S5") {
  // 8. Custom pattern from S5's secret_patterns_extra
  await probe(
    "custom-secret-svc_tok",
    "block",
    { tool: "bash", sessionID: "t", callID: "8" },
    { args: { command: "echo svc_tok_ABCDEFGHIJKLMNOPQRST" } },
  );
}

if (scenarioId === "S7") {
  // 9. Custom forbidden combo (read + write-doc + commit)
  await probe(
    "custom-combo-my-extra-rule",
    "block",
    { tool: "task", sessionID: "t", callID: "9" },
    { args: { agent: "business-analyst", prompt: "lee el archivo foo.md, redacta un resumen, y haz git commit con el resultado" } },
  );

  // 10. Custom pattern pst_ from S7
  await probe(
    "custom-secret-pst",
    "block",
    { tool: "bash", sessionID: "t", callID: "10" },
    { args: { command: "TOKEN=pst_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } },
  );
}

// Runaway PRE side (just to exercise the marker write)
if (after) {
  await before?.(
    { tool: "task", sessionID: "t", callID: "runaway-pre" },
    { args: { agent: "developer-backend", prompt: "small task" } },
  );
  await after(
    { tool: "task", sessionID: "t", callID: "runaway-pre", args: { agent: "developer-backend" } },
    { title: "x", output: "x".repeat(300_000), metadata: {} },  // ~1200 parts proxy
  );
  console.log(`  ℹ runaway notice expected on stderr above (300K chars output)`);
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
