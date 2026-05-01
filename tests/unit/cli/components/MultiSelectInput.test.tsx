import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { MultiSelectInput } from "../../../../src/cli/components/MultiSelectInput.tsx";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("MultiSelectInput", () => {
  const opts = [
    { label: "Uno", value: "1" },
    { label: "Dos", value: "2" },
    { label: "Tres", value: "3" },
  ];

  it("submits empty array when nothing is marked and Enter is pressed", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <MultiSelectInput label="Marca:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("space toggles current cursor item, Enter submits", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <MultiSelectInput label="Marca:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    // Cursor at index 0, toggle "1"
    stdin.write(" ");
    await wait();
    // Move down, toggle "2"
    stdin.write("\u001b[B");
    await wait();
    stdin.write(" ");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(["1", "2"]);
  });

  it("'a' selects all, Enter submits", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <MultiSelectInput label="Marca:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("a");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith(["1", "2", "3"]);
  });

  it("'n' clears selection", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <MultiSelectInput label="Marca:" options={opts} onSubmit={onSubmit} />,
    );
    await wait();
    stdin.write("a");
    await wait();
    stdin.write("n");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith([]);
  });
});
