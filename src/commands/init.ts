import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { scanRepo } from "../indexer/scanner.js";
import { detectModules } from "../indexer/modules.js";
import {
  buildIndexMarkdown,
  buildStructureMarkdown,
  buildGraphReport,
  readPackageJson,
  readReadmeSnippet,
  IndexData,
} from "../indexer/markdown.js";
import { ensureDir, writeJsonFile, getOutDir, getMissionsDir } from "../utils/fs.js";

export async function initiCommand(dir: string = process.cwd()): Promise<void> {
  console.log(chalk.bold("\n CodeGuide - init\n"));

  const spinner = ora("Scanning repository...").start();

  try {
    // 1. Scan files
    const files = scanRepo(dir);
    spinner.text = `Detecting modules (${files.length} files found)...`;

    // 2. Detect modules
    const modules = detectModules(files, dir);

    // 3. Read project metadata
    const packageJSON = readPackageJson(dir);
    const readmeSnippet = readReadmeSnippet(dir);
    const projectName = (packageJSON?.name as string) ?? path.basename(dir);

    const data: IndexData = {
      projectName,
      generatedAt: new Date().toISOString(),
      fileCount: files.length,
      moduleCount: modules.filter((m) => !m.isTest).length,
      modules,
      files,
      repoRoot: dir,
      packageJSON,
      readmeSnippet,
    };

    spinner.text = "Building index files...";

    // 4. Build markdown files
    const indexMd = buildIndexMarkdown(data);
    const structureMd = buildStructureMarkdown(data);
    const graphReport = buildGraphReport(data);

    // 5. Write output
    const outDir = getOutDir(dir);
    ensureDir(outDir);
    ensureDir(getMissionsDir(dir));

    fs.writeFileSync(path.join(outDir, "INDEX.md"), indexMd);
    fs.writeFileSync(path.join(outDir, "STRUCTURE.md"), structureMd);
    fs.writeFileSync(path.join(outDir, "GRAPH_REPORT.md"), graphReport);

    // Machine-readable manifest for sync/tooling
    writeJsonFile(path.join(outDir, "manifest.json"), {
      projectName,
      generatedAt: data.generatedAt,
      fileCount: files.length,
      moduleCount: data.moduleCount,
      modules: modules.map((m) => ({
        name: m.name,
        directory: m.directory,
        purpose: m.purpose,
        language: m.language,
        isTest: m.isTest,
        fileCount: files.filter((f) => f.path.startsWith(m.directory)).length,
      })),
      files: files.map((f) => ({
        path: f.path,
        extension: f.extension,
        sizeBytes: f.sizeBytes,
        indexedAt: data.generatedAt,
      })),
    });

    spinner.succeed(`Indexed ${files.length} files across ${data.moduleCount} modules`);

    // print summary
    console.log("");
    console.log(chalk.bold(` ${projectName}`));
    console.log("");

    const nonTestModules = modules.filter((m) => !m.isTest);
    for (const mod of nonTestModules) {
      console.log(`   ${chalk.cyan(mod.directory + "/")} ${chalk.dim(mod.purpose)}`);
    }

    console.log("");
    console.log(chalk.dim(`  Output: codeguide-out/`));
    console.log(chalk.dim(`    INDEX.md       — module map Claude reads first`));
    console.log(chalk.dim(`    STRUCTURE.md   — dependency graph`));
    console.log(chalk.dim(`    GRAPH_REPORT.md — quick-read summary`));
    console.log(chalk.dim(`    missions/       — generated missions saved here`));
    console.log("");
    console.log(chalk.dim("  Tip: commit codeguide-out/ so teammates and CI skip regeneration:"));
    console.log(
      chalk.dim('    git add codeguide-out/ && git commit -m "chore: add codeguide index"')
    );
    console.log("");
    console.log(chalk.bold("  Open a Claude Code or Codex session and try:"));
    console.log(chalk.cyan("    /codeguide tour"));

    if (nonTestModules.length > 0) {
      const suggested =
        nonTestModules.find((m) =>
          ["auth", "authentication", "payments", "users", "database"].includes(m.name)
        ) ?? nonTestModules[0];
      console.log(chalk.cyan(`    /codeguide mission ${suggested.name}`));
    }

    console.log("");
  } catch (err) {
    spinner.fail("Indexing failed");
    console.error(chalk.red("\n" + String(err)));
    process.exit(1);
  }
}
