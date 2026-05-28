import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doctorCommand } from "../../src/commands/doctor.js";

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

  function output() {
    return (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

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

  // ─── All checks pass ──────────────────────────────────────────────────────────

  it("prints ✓ for every artifact when all files have correct markers", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    const out = output();
    expect(out).toContain("✓ CLAUDE.md");
    expect(out).toContain("✓ AGENTS.md");
    expect(out).toContain("✓ .claude/settings.json hook");
    expect(out).toContain("✓ codeguide-out/INDEX.md");
    expect(out).toContain("✓ codeguide-out/STRUCTURE.md");
    expect(out).toContain("✓ codeguide-out/GRAPH_REPORT.md");
  });

  it("prints 'All checks passed' when every artifact is present and correct", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    expect(output()).toContain("All checks passed");
  });

  it("suggests /codeguide tour after a passing check", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    expect(output()).toContain("/codeguide tour");
  });

  // ─── Missing files ────────────────────────────────────────────────────────────

  it("prints ✗ for each artifact that does not exist", () => {
    doctorCommand(tmpDir);
    const out = output();
    expect(out).toContain("✗ CLAUDE.md");
    expect(out).toContain("✗ AGENTS.md");
    expect(out).toContain("✗ codeguide-out/INDEX.md");
  });

  it("prints 'Some checks failed' when any artifact is missing", () => {
    doctorCommand(tmpDir);
    expect(output()).toContain("Some checks failed");
  });

  it("suggests codeguide install and codeguide init to fix failures", () => {
    doctorCommand(tmpDir);
    const out = output();
    expect(out).toContain("codeguide install");
    expect(out).toContain("codeguide init");
  });

  // ─── File exists but marker missing ──────────────────────────────────────────

  it("prints ⚠ when CLAUDE.md exists but has no CodeGuide section", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "# My project\n");
    doctorCommand(tmpDir);
    expect(output()).toContain("⚠ CLAUDE.md");
  });

  it("prints ⚠ when AGENTS.md exists but has no CodeGuide section", () => {
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# My project\n");
    doctorCommand(tmpDir);
    expect(output()).toContain("⚠ AGENTS.md");
  });

  it("prints ⚠ when INDEX.md exists but has no CodeGuide marker", () => {
    const outDir = path.join(tmpDir, "codeguide-out");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "INDEX.md"), "some content without the marker\n");
    doctorCommand(tmpDir);
    expect(output()).toContain("⚠ codeguide-out/INDEX.md");
  });

  // ─── Missions ────────────────────────────────────────────────────────────────

  it("shows the mission count when mission files are present", () => {
    makeAllChecks();
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(path.join(missionsDir, "auth.md"), "# Mission: auth\n");
    fs.writeFileSync(path.join(missionsDir, "scanner.md"), "# Mission: scanner\n");
    doctorCommand(tmpDir);
    expect(output()).toContain("2 mission(s)");
  });

  it("lists mission names in the output", () => {
    makeAllChecks();
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(path.join(missionsDir, "auth.md"), "# Mission: auth\n");
    doctorCommand(tmpDir);
    expect(output()).toContain("auth");
  });

  it("ignores non-.md files in the missions directory", () => {
    makeAllChecks();
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(path.join(missionsDir, "auth.md"), "# Mission: auth\n");
    fs.writeFileSync(path.join(missionsDir, ".DS_Store"), "junk");
    doctorCommand(tmpDir);
    expect(output()).toContain("1 mission(s)");
  });

  it("prints 'No missions yet' when the missions directory is empty", () => {
    makeAllChecks();
    doctorCommand(tmpDir);
    expect(output()).toContain("No missions yet");
  });

  it("prints 'No missions yet' when the missions directory does not exist", () => {
    makeAllChecks();
    // missions dir not created — only outDir files exist
    doctorCommand(tmpDir);
    expect(output()).toContain("No missions yet");
  });
});
