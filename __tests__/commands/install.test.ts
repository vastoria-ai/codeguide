import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installCommand } from "../../src/commands/install.js";

describe("installCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-install-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ─── CLAUDE.md ───────────────────────────────────────────────────────────────

  it("creates CLAUDE.md with the directive on a fresh install", () => {
    installCommand(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("CodeGuide — codebase learning");
  });

  it("appends directive to an existing CLAUDE.md that has no marker", () => {
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(claudeMdPath, "# My project\n");
    installCommand(tmpDir);
    const content = fs.readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("# My project");
    expect(content).toContain("CodeGuide — codebase learning");
  });

  it("does not re-append to CLAUDE.md when the marker is already present", () => {
    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(claudeMdPath, "## CodeGuide — codebase learning\nexisting");
    installCommand(tmpDir);
    const occurrences =
      fs.readFileSync(claudeMdPath, "utf-8").split("CodeGuide — codebase learning").length - 1;
    expect(occurrences).toBe(1);
  });

  // ─── AGENTS.md ───────────────────────────────────────────────────────────────

  it("creates AGENTS.md with the directive on a fresh install", () => {
    installCommand(tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, "AGENTS.md"), "utf-8");
    expect(content).toContain("CodeGuide — codebase learning");
  });

  it("appends directive to an existing AGENTS.md that has no marker", () => {
    const agentsMdPath = path.join(tmpDir, "AGENTS.md");
    fs.writeFileSync(agentsMdPath, "# My project\n");
    installCommand(tmpDir);
    const content = fs.readFileSync(agentsMdPath, "utf-8");
    expect(content).toContain("# My project");
    expect(content).toContain("CodeGuide — codebase learning");
  });

  it("does not re-append to AGENTS.md when the marker is already present", () => {
    const agentsMdPath = path.join(tmpDir, "AGENTS.md");
    fs.writeFileSync(agentsMdPath, "## CodeGuide — codebase learning\nexisting");
    installCommand(tmpDir);
    const occurrences =
      fs.readFileSync(agentsMdPath, "utf-8").split("CodeGuide — codebase learning").length - 1;
    expect(occurrences).toBe(1);
  });

  // ─── .claude/settings.json ───────────────────────────────────────────────────

  it("creates .claude/ directory if it does not exist", () => {
    installCommand(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
  });

  it("writes the PreToolUse hook to .claude/settings.json", () => {
    installCommand(tmpDir);
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.hooks.PreToolUse[0].matcher).toBe("Glob|Grep|Read");
    expect(settings.hooks.PreToolUse[0].hooks[0].type).toBe("command");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe("codeguide hook-check");
  });

  it("merges hook config into an existing settings.json without losing other keys", () => {
    const settingsDir = path.join(tmpDir, ".claude");
    const settingsPath = path.join(settingsDir, "settings.json");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify({ theme: "dark", permissions: [] }, null, 2));

    installCommand(tmpDir);

    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    expect(settings.theme).toBe("dark");
    expect(settings.permissions).toEqual([]);
    expect(settings.hooks.PreToolUse).toBeDefined();
  });

  it("is idempotent — running install twice does not duplicate settings", () => {
    installCommand(tmpDir);
    installCommand(tmpDir);
    const settings = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8")
    );
    expect(settings.hooks.PreToolUse).toHaveLength(1);
  });

  // ─── Console output ──────────────────────────────────────────────────────────

  it("logs success messages for CLAUDE.md, AGENTS.md, and settings.json on fresh install", () => {
    installCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("CLAUDE.md");
    expect(output).toContain("AGENTS.md");
    expect(output).toContain(".claude/settings.json");
  });

  it("logs 'already has CodeGuide section' when CLAUDE.md marker is present", () => {
    fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "## CodeGuide — codebase learning\n");
    installCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("CLAUDE.md already has CodeGuide section");
  });

  it("logs 'already has CodeGuide section' when AGENTS.md marker is present", () => {
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "## CodeGuide — codebase learning\n");
    installCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("AGENTS.md already has CodeGuide section");
  });
});
