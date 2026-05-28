import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askCommand } from "../../src/commands/ask.js";

describe("askCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-ask-"));
    outDir = path.join(tmpDir, "codeguide-out");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeIndex() {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "# CodeGuide Index\n");
  }

  function output() {
    return (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

  function errors() {
    return (console.error as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

  // ─── Guard ──────────────────────────────────────────────────────────────────

  it("calls process.exit(1) when INDEX.md does not exist", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    askCommand("how does auth work?", tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs an error telling the user to run codeguide init first", () => {
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    askCommand("how does auth work?", tmpDir);
    expect(errors()).toContain("codeguide init");
  });

  // ─── Output ─────────────────────────────────────────────────────────────────

  it("echoes the question in the output", () => {
    makeIndex();
    askCommand("how does auth work?", tmpDir);
    expect(output()).toContain("how does auth work?");
  });

  it("prints INSTRUCTION FOR AI section", () => {
    makeIndex();
    askCommand("what is the entry point?", tmpDir);
    expect(output()).toContain("INSTRUCTION FOR AI:");
  });

  it("prints QUESTION: <question>", () => {
    makeIndex();
    askCommand("where is the router?", tmpDir);
    expect(output()).toContain("QUESTION: where is the router?");
  });

  it("instructs the AI to use specific file paths and line numbers", () => {
    makeIndex();
    askCommand("how does scanning work?", tmpDir);
    expect(output()).toContain("line number");
  });

  it("instructs the AI to reference actual functions and classes from the codebase", () => {
    makeIndex();
    askCommand("what handles routing?", tmpDir);
    expect(output()).toContain("THIS codebase");
  });

  it("works with multi-word questions", () => {
    makeIndex();
    askCommand("how does the scanner detect modules?", tmpDir);
    expect(output()).toContain("QUESTION: how does the scanner detect modules?");
  });
});
