import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tourCommand } from "../../src/commands/tour.js";

describe("tourCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-tour-"));
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
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "# CodeGuide Index\n\n## Modules\n");
  }

  function makeGraphReport(content = "# CodeGuide Report\n\nGraph summary.") {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "GRAPH_REPORT.md"), content);
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
    tourCommand(tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs an error telling the user to run codeguide init first", () => {
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    tourCommand(tmpDir);
    expect(errors()).toContain("codeguide init");
  });

  // ─── Output ─────────────────────────────────────────────────────────────────

  it("prints the starting tour message", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(output()).toContain("[CodeGuide] Starting codebase tour.");
  });

  it("prints INSTRUCTION FOR AI section", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(output()).toContain("INSTRUCTION FOR AI:");
  });

  it("instructs the AI to read INDEX.md and GRAPH_REPORT.md", () => {
    makeIndex();
    tourCommand(tmpDir);
    const out = output();
    expect(out).toContain("codeguide-out/INDEX.md");
    expect(out).toContain("codeguide-out/GRAPH_REPORT.md");
  });

  it("includes all five tour sections in the instructions", () => {
    makeIndex();
    tourCommand(tmpDir);
    const out = output();
    expect(out).toContain("What this project does");
    expect(out).toContain("Module map");
    expect(out).toContain("5 most important files");
    expect(out).toContain("3 core concepts");
    expect(out).toContain("Suggested first mission");
  });

  it("suggests /codeguide mission in the output", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(output()).toContain("/codeguide mission");
  });

  // ─── Graph report ────────────────────────────────────────────────────────────

  it("prints GRAPH REPORT CONTEXT when GRAPH_REPORT.md exists", () => {
    makeIndex();
    makeGraphReport();
    tourCommand(tmpDir);
    expect(output()).toContain("GRAPH REPORT CONTEXT:");
  });

  it("does not print GRAPH REPORT CONTEXT when GRAPH_REPORT.md is absent", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(output()).not.toContain("GRAPH REPORT CONTEXT:");
  });

  it("truncates the graph report content at 3000 chars", () => {
    makeIndex();
    makeGraphReport("# CodeGuide Report\n" + "x".repeat(5000));
    tourCommand(tmpDir);
    const xxCount = (output().match(/x+/g) ?? []).reduce((sum, s) => sum + s.length, 0);
    expect(xxCount).toBeLessThan(5000);
  });
});
