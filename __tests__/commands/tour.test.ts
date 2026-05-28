import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  tourCommand,
  askCommand,
  hookCheckCommand,
  syncCommand,
  doctorCommand,
} from "../../src/commands/tour.js";

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  }),
}));

vi.mock("../../src/commands/init.js", () => ({
  initiCommand: vi.fn().mockResolvedValue(undefined),
}));

// ─── Shared helpers ───────────────────────────────────────────────────────────

function consoleOutput(spy = console.log as ReturnType<typeof vi.spyOn>) {
  return (spy as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
}

// ─── tourCommand ─────────────────────────────────────────────────────────────

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
    expect(consoleOutput(console.error as ReturnType<typeof vi.spyOn>)).toContain("codeguide init");
  });

  // ─── Output ─────────────────────────────────────────────────────────────────

  it("prints the starting tour message", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(consoleOutput()).toContain("[CodeGuide] Starting codebase tour.");
  });

  it("prints INSTRUCTION FOR AI section", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(consoleOutput()).toContain("INSTRUCTION FOR AI:");
  });

  it("instructs the AI to read INDEX.md and GRAPH_REPORT.md", () => {
    makeIndex();
    tourCommand(tmpDir);
    const out = consoleOutput();
    expect(out).toContain("codeguide-out/INDEX.md");
    expect(out).toContain("codeguide-out/GRAPH_REPORT.md");
  });

  it("includes all five tour sections in the instructions", () => {
    makeIndex();
    tourCommand(tmpDir);
    const out = consoleOutput();
    expect(out).toContain("What this project does");
    expect(out).toContain("Module map");
    expect(out).toContain("5 most important files");
    expect(out).toContain("3 core concepts");
    expect(out).toContain("Suggested first mission");
  });

  it("suggests /codeguide mission in the output", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(consoleOutput()).toContain("/codeguide mission");
  });

  // ─── Graph report ────────────────────────────────────────────────────────────

  it("prints GRAPH REPORT CONTEXT when GRAPH_REPORT.md exists", () => {
    makeIndex();
    makeGraphReport();
    tourCommand(tmpDir);
    expect(consoleOutput()).toContain("GRAPH REPORT CONTEXT:");
  });

  it("does not print GRAPH REPORT CONTEXT when GRAPH_REPORT.md is absent", () => {
    makeIndex();
    tourCommand(tmpDir);
    expect(consoleOutput()).not.toContain("GRAPH REPORT CONTEXT:");
  });

  it("truncates the graph report content at 3000 chars", () => {
    makeIndex();
    makeGraphReport("# CodeGuide Report\n" + "x".repeat(5000));
    tourCommand(tmpDir);
    // The 5000-char filler should be cut — total output won't contain all of it
    const out = consoleOutput();
    const xxCount = (out.match(/x+/g) ?? []).reduce((sum, s) => sum + s.length, 0);
    expect(xxCount).toBeLessThan(5000);
  });
});

// ─── askCommand ──────────────────────────────────────────────────────────────

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
    expect(consoleOutput(console.error as ReturnType<typeof vi.spyOn>)).toContain("codeguide init");
  });

  // ─── Output ─────────────────────────────────────────────────────────────────

  it("echoes the question in the output", () => {
    makeIndex();
    askCommand("how does auth work?", tmpDir);
    expect(consoleOutput()).toContain("how does auth work?");
  });

  it("prints INSTRUCTION FOR AI section", () => {
    makeIndex();
    askCommand("what is the entry point?", tmpDir);
    expect(consoleOutput()).toContain("INSTRUCTION FOR AI:");
  });

  it("prints QUESTION: <question>", () => {
    makeIndex();
    askCommand("where is the router?", tmpDir);
    expect(consoleOutput()).toContain("QUESTION: where is the router?");
  });

  it("instructs the AI to use specific file paths and line numbers", () => {
    makeIndex();
    askCommand("how does scanning work?", tmpDir);
    expect(consoleOutput()).toContain("line number");
  });
});

// ─── hookCheckCommand ────────────────────────────────────────────────────────

describe("hookCheckCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-hook-"));
    outDir = path.join(tmpDir, "codeguide-out");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes to stdout when INDEX.md exists", () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "# CodeGuide Index\n");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    expect(writeSpy).toHaveBeenCalled();
  });

  it("output mentions the index path", () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "# CodeGuide Index\n");
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    const written = writeSpy.mock.calls.flat().join("");
    expect(written).toContain("codeguide-out/INDEX.md");
  });

  it("writes nothing when INDEX.md does not exist", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

// ─── syncCommand ─────────────────────────────────────────────────────────────

describe("syncCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-sync-"));
    outDir = path.join(tmpDir, "codeguide-out");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeManifest(generatedAt: string) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "manifest.json"),
      JSON.stringify({ generatedAt, fileCount: 0, moduleCount: 0, modules: [], files: [] }, null, 2)
    );
  }

  function makeProject() {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const x = 1;");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project" }, null, 2)
    );
  }

  // ─── No manifest ────────────────────────────────────────────────────────────

  it("logs a yellow message and falls back to init when no manifest exists", async () => {
    await syncCommand(tmpDir);
    expect(consoleOutput()).toContain("No manifest found");
  });

  it("calls initiCommand when no manifest exists", async () => {
    const { initiCommand } = await import("../../src/commands/init.js");
    await syncCommand(tmpDir);
    expect(initiCommand).toHaveBeenCalledWith(tmpDir);
  });

  // ─── Up to date ─────────────────────────────────────────────────────────────

  it("does not rebuild the index when no files have changed since the last index", async () => {
    makeProject();
    const futureTime = new Date(Date.now() + 10_000_000).toISOString();
    makeManifest(futureTime);
    await syncCommand(tmpDir);
    // manifest.generatedAt is untouched — no rebuild happened
    const saved = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf-8"));
    expect(saved.generatedAt).toBe(futureTime);
  });

  // ─── Changed files ───────────────────────────────────────────────────────────

  it("rebuilds INDEX.md when files have changed since the last index", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString()); // epoch — all files appear newer
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "INDEX.md"))).toBe(true);
  });

  it("rebuilds STRUCTURE.md and GRAPH_REPORT.md when files have changed", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "STRUCTURE.md"))).toBe(true);
    expect(fs.existsSync(path.join(outDir, "GRAPH_REPORT.md"))).toBe(true);
  });

  it("updates manifest.generatedAt after a successful sync", async () => {
    makeProject();
    const oldTime = new Date(0).toISOString();
    makeManifest(oldTime);
    await syncCommand(tmpDir);
    const updated = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf-8"));
    expect(updated.generatedAt).not.toBe(oldTime);
  });

  // ─── Error handling ─────────────────────────────────────────────────────────

  it("calls process.exit(1) when sync fails", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("write error");
    });
    await syncCommand(tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

// ─── doctorCommand ───────────────────────────────────────────────────────────

describe("doctorCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-doctor-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeAllChecks() {
    const outDir = path.join(tmpDir, "codeguide-out");
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "## CodeGuide — codebase learning\n");
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "## CodeGuide — codebase learning\n");
    fs.writeFileSync(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: "codeguide hook-check" }] }] } })
    );
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "# CodeGuide Index\n");
    fs.writeFileSync(path.join(outDir, "STRUCTURE.md"), "# CodeGuide Structure\n");
    fs.writeFileSync(path.join(outDir, "GRAPH_REPORT.md"), "# CodeGuide Report\n");
  }

  // ─── All checks pass ─────────────────────────────────────────────────────────

  it("prints all green checkmarks when every file exists with its marker", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    const out = consoleOutput();
    expect(out).toContain("✓ CLAUDE.md");
    expect(out).toContain("✓ AGENTS.md");
    expect(out).toContain("✓ .claude/settings.json hook");
    expect(out).toContain("✓ codeguide-out/INDEX.md");
    expect(out).toContain("✓ codeguide-out/STRUCTURE.md");
    expect(out).toContain("✓ codeguide-out/GRAPH_REPORT.md");
  });

  it("prints 'All checks passed' when all files have correct markers", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("All checks passed");
  });

  // ─── Missing files ───────────────────────────────────────────────────────────

  it("prints ✗ for files that do not exist", () => {
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("✗ CLAUDE.md");
  });

  it("prints 'Some checks failed' when any file is missing", () => {
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("Some checks failed");
  });

  // ─── File exists but marker missing ─────────────────────────────────────────

  it("prints ⚠ when CLAUDE.md exists but has no CodeGuide section", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# My project\n");
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("⚠ CLAUDE.md");
  });

  // ─── Missions ───────────────────────────────────────────────────────────────

  it("shows the mission count when mission files are present", () => {
    makeAllChecks();
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(path.join(missionsDir, "auth.md"), "# Mission: auth\n");
    fs.writeFileSync(path.join(missionsDir, "scanner.md"), "# Mission: scanner\n");
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("2 mission(s)");
  });

  it("shows the mission names in the output", () => {
    makeAllChecks();
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(path.join(missionsDir, "auth.md"), "# Mission: auth\n");
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("auth");
  });

  it("prints 'No missions yet' when the missions directory is empty", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    expect(consoleOutput()).toContain("No missions yet");
  });
});
