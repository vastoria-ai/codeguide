import { spawnSync } from "child_process";
import path from "path";
import { describe, expect, it } from "vitest";

const tsx = path.resolve("node_modules/.bin/tsx");
const cli = path.resolve("src/bin/cli.ts");

function run(...args: string[]) {
  return spawnSync(tsx, [cli, ...args], { encoding: "utf-8" });
}

describe("cli", () => {
  it("prints the version", () => {
    const result = run("--version");
    expect(result.stdout.trim()).toBe("0.1.0");
    expect(result.status).toBe(0);
  });

  it("--help lists all registered commands", () => {
    const result = run("--help");
    expect(result.status).toBe(0);
    for (const cmd of [
      "install",
      "init",
      "sync",
      "mission",
      "tour",
      "ask",
      "hook-check",
      "doctor",
    ]) {
      expect(result.stdout, `expected --help to mention '${cmd}'`).toContain(cmd);
    }
  });

  it.each(["install", "init", "sync", "tour", "hook-check", "doctor"])(
    "command '%s' exits with code 0",
    (cmd) => {
      const result = run(cmd);
      expect(result.status).toBe(0);
    }
  );

  it("mission command accepts a topic argument and exits 0", () => {
    const result = run("mission", "auth");
    expect(result.status).toBe(0);
  });

  it("ask command accepts a question argument and exits 0", () => {
    const result = run("ask", "what does auth do");
    expect(result.status).toBe(0);
  });

  it("exits non-zero for an unknown command", () => {
    const result = run("unknown-command-xyz");
    expect(result.status).not.toBe(0);
  });
});
