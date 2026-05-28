import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

import { getOutDir, getMissionsDir } from "../utils/fs.js";
import { scanRepo } from "../indexer/scanner.js";
import { detectModules } from "../indexer/modules.js";
import {
  buildIndexMarkdown,
  buildStructureMarkdown,
  buildGraphReport,
  readPackageJson,
  readReadmeSnippet,
} from "../indexer/markdown.js";

export function tourCommand(dir: string = process.cwd()): void {
  const outDir = getOutDir(dir);
  const indexPath = path.join(outDir, "INDEX.md");
  const reportPath = path.join(outDir, "GRAPH_REPORT.md");

  if (!fs.existsSync(indexPath)) {
    console.error(chalk.red("[CodeGuide] No index found. Run `codeguide init` first."));
    process.exit(1);
  }

  // Outputs instructions that Claude / Codex reads and acts on inline
  console.log("[CodeGuide] Starting codebase tour.");
  console.log("");
  console.log("INSTRUCTION FOR AI:");
  console.log("Read codeguide-out/INDEX.md and codeguide-out/GRAPH_REPORT.md.");
  console.log("Then give the user a structured orientation in this format:");
  console.log("");
  console.log("1. **What this project does** — 2-3 sentences. Plain English, no jargon.");
  console.log("   Source: README snippet + package.json description in the index.");
  console.log("");
  console.log("2. **Module map** — for each module in INDEX.md, one sentence on what it does.");
  console.log("   Explain how the modules connect to each other.");
  console.log("");
  console.log("3. **The 5 most important files** — the ones a new engineer must read first.");
  console.log("   Explain WHY each one matters, not just what it is.");
  console.log("");
  console.log(
    "4. **3 core concepts** — the mental models that unlock understanding of the whole system."
  );
  console.log("   Give a concrete example from the actual code for each.");
  console.log("");
  console.log("5. **Suggested first mission** — pick the most foundational topic and suggest:");
  console.log(
    '   "/codeguide mission <topic>" — explain why that topic is the best starting point.'
  );
  console.log("");
  console.log(
    "Keep the tone conversational. You are a senior engineer giving a new hire their first tour."
  );
  console.log("Do not just reformat the INDEX.md. Give genuine insight.");

  if (fs.existsSync(reportPath)) {
    console.log("");
    console.log("GRAPH REPORT CONTEXT:");
    console.log("---");
    console.log(fs.readFileSync(reportPath, "utf-8").slice(0, 3000));
    console.log("---");
  }
}

export function askCommand(question: string, dir: string = process.cwd()): void {
  const outDir = getOutDir(dir);
  const indexPath = path.join(outDir, "INDEX.md");

  if (!fs.existsSync(indexPath)) {
    console.error(chalk.red("[CodeGuide] No index found. Run `codeguide init` first."));
    process.exit(1);
  }

  console.log(`[CodeGuide] Question: "${question}"`);
  console.log("");
  console.log("INSTRUCTION FOR AI:");
  console.log("Read codeguide-out/INDEX.md to find the relevant module and files.");
  console.log("Answer the question with:");
  console.log("- Specific file paths and line number ranges");
  console.log("- References to actual functions, classes, or variables from the codebase");
  console.log("- No generic advice — everything must be specific to THIS codebase");
  console.log("If the index points to files you need to read directly, do so.");
  console.log("");
  console.log(`QUESTION: ${question}`);
}

export function hookCheckCommand(dir: string = process.cwd()): void {
  const indexPath = path.join(getOutDir(dir), "INDEX.md");
  if (fs.existsSync(indexPath)) {
    // Claude sees this before every file search and consults the index first
    process.stdout.write(
      "[CodeGuide] Index available at codeguide-out/INDEX.md. " +
        "Consult it before searching raw files — it maps every module with key files and line ranges.\n"
    );
  }
}

export async function syncCommand(dir: string = process.cwd()): Promise<void> {
  const outDir = getOutDir(dir);
  const manifestPath = path.join(outDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.log(chalk.yellow("[CodeGuide] No manifest found. Running full init instead."));
    const { initiCommand } = await import("./init.js");
    await initiCommand(dir);
    return;
  }

  const spinner = ora("Syncing changes...").start();

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const lastIndexed = new Date(manifest.generatedAt).getTime();

    const allFiles = scanRepo(dir);
    const changedFiles = allFiles.filter((f) => {
      const stat = fs.statSync(f.absolutePath);
      return stat.mtimeMs > lastIndexed;
    });

    if (changedFiles.length === 0) {
      spinner.succeed("Already up to date — no changes since last index");
      return;
    }

    spinner.text = `Found ${changedFiles.length} changed files — rebuilding index...`;

    // Full rebuild (incremental is a V2 feature)
    const modules = detectModules(allFiles, dir);
    const packageJson = readPackageJson(dir);
    const readmeSnippet = readReadmeSnippet(dir);
    const projectName = (packageJson?.name as string) ?? path.basename(dir);

    const data = {
      projectName,
      generatedAt: new Date().toISOString(),
      fileCount: allFiles.length,
      moduleCount: modules.filter((m) => !m.isTest).length,
      modules,
      files: allFiles,
      repoRoot: dir,
      packageJson,
      readmeSnippet,
    };

    fs.writeFileSync(path.join(outDir, "INDEX.md"), buildIndexMarkdown(data));
    fs.writeFileSync(path.join(outDir, "STRUCTURE.md"), buildStructureMarkdown(data));
    fs.writeFileSync(path.join(outDir, "GRAPH_REPORT.md"), buildGraphReport(data));

    // Update manifest timestamp
    manifest.generatedAt = data.generatedAt;
    manifest.fileCount = allFiles.length;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    spinner.succeed(`Synced — ${changedFiles.length} changed files, ${allFiles.length} total`);
  } catch (err) {
    spinner.fail("Sync failed: " + String(err));
    process.exit(1);
  }
}

export function doctorCommand(dir: string = process.cwd()): void {
  console.log(chalk.bold("\n  CodeGuide — doctor\n"));

  const checks = [
    {
      label: "CLAUDE.md exists",
      path: path.join(dir, "CLAUDE.md"),
      marker: "CodeGuide",
      platform: "Claude Code",
    },
    {
      label: "AGENTS.md exists",
      path: path.join(dir, "AGENTS.md"),
      marker: "CodeGuide",
      platform: "Codex / Cursor / OpenCode",
    },
    {
      label: ".claude/settings.json hook",
      path: path.join(dir, ".claude", "settings.json"),
      marker: "codeguide hook-check",
      platform: "Claude Code PreToolUse",
    },
    {
      label: "codeguide-out/INDEX.md",
      path: path.join(dir, "codeguide-out", "INDEX.md"),
      marker: "# CodeGuide Index",
      platform: "All platforms",
    },
    {
      label: "codeguide-out/STRUCTURE.md",
      path: path.join(dir, "codeguide-out", "STRUCTURE.md"),
      marker: "# CodeGuide Structure",
      platform: "All platforms",
    },
    {
      label: "codeguide-out/GRAPH_REPORT.md",
      path: path.join(dir, "codeguide-out", "GRAPH_REPORT.md"),
      marker: "# CodeGuide Report",
      platform: "All platforms",
    },
  ];

  let allGood = true;

  for (const check of checks) {
    const exists = fs.existsSync(check.path);
    const hasMarker = exists && fs.readFileSync(check.path, "utf-8").includes(check.marker);

    if (hasMarker) {
      console.log(chalk.green(`  ✓ ${check.label}`) + chalk.dim(`  [${check.platform}]`));
    } else if (exists) {
      console.log(
        chalk.yellow(`  ⚠ ${check.label} — file exists but CodeGuide section missing`) +
          chalk.dim(`  [${check.platform}]`)
      );
      allGood = false;
    } else {
      console.log(chalk.red(`  ✗ ${check.label} — not found`) + chalk.dim(`  [${check.platform}]`));
      allGood = false;
    }
  }

  // Missions check
  const missionsDir = getMissionsDir(dir);
  const missionFiles = fs.existsSync(missionsDir)
    ? fs.readdirSync(missionsDir).filter((f) => f.endsWith(".md"))
    : [];

  if (missionFiles.length > 0) {
    console.log(
      chalk.green(`  ✓ ${missionFiles.length} mission(s) in codeguide-out/missions/`) +
        chalk.dim(`  [${missionFiles.map((f) => f.replace(".md", "")).join(", ")}]`)
    );
  } else {
    console.log(chalk.dim("  · No missions yet — run `/codeguide mission <topic>` in a session"));
  }

  console.log("");

  if (allGood) {
    console.log(chalk.green.bold("  All checks passed."));
    console.log(chalk.dim("  Open a Claude Code or Codex session and try /codeguide tour"));
  } else {
    console.log(chalk.yellow.bold("  Some checks failed."));
    console.log(chalk.dim("  Run `codeguide install` then `codeguide init` to fix."));
  }

  console.log("");
}
