import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextInput } from "../../../../src/cli/components/TextInput.tsx";

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("TextInput", () => {
  it("renders the label", () => {
    const { lastFrame } = render(
      <TextInput label="Ruta:" onSubmit={() => {}} />,
    );
    expect(lastFrame()).toContain("Ruta:");
  });

  it("calls onSubmit with the typed value on Enter", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<TextInput label="Ruta:" onSubmit={onSubmit} />);
    await wait();
    stdin.write("hola");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith("hola");
  });

  it("uses initialValue if provided", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <TextInput label="Ruta:" initialValue="default" onSubmit={onSubmit} />,
    );
    await wait();
    expect(lastFrame()).toContain("default");
    stdin.write("\r");
    await wait();
    expect(onSubmit).toHaveBeenCalledWith("default");
  });

  it("blocks submit and shows error when validate fails", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <TextInput
        label="Ruta:"
        validate={(v) => (v.length < 3 ? "muy corto" : null)}
        onSubmit={onSubmit}
      />,
    );
    await wait();
    stdin.write("ab");
    await wait();
    stdin.write("\r");
    await wait();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("muy corto");
  });
});
