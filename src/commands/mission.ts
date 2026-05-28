import fs from "fs";
import path from "path";
import chalk from "chalk";

import { getOutDir, getMissionsDir } from "../utils/fs.js";

export function missionCommand(topic: string, dir: string = process.cwd()): void {
  const outDir = getOutDir(dir);
  const missionDir = getMissionsDir(dir);
  const indexPath = path.join(outDir, "INDEX.md");
  const manifestPath = path.join(outDir, "manifest.json");

  // Guard: must have run init first
  if (!fs.existsSync(indexPath)) {
    console.error(chalk.red("[CodeGuide] No index found. Run `codeguide init` first."));
    process.exit(1);
  }

  const missionFile = path.join(missionDir, `${topic}.md`);
  const missionExists = fs.existsSync(missionFile);

  // Find the closest matching module from the manifest
  let moduleContext = "";
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const match = manifest.modules?.find(
        (m: { name: string; directory: string; purpose: string }) =>
          m.name === topic ||
          m.directory.includes(topic) ||
          m.purpose.toLowerCase().includes(topic.toLowerCase())
      );
      if (match) {
        moduleContext = `Matched module: ${match.directory}/ - ${match.purpose}`;
      }
    } catch {
      // ignore
    }
  }

  // ─── Output is read by Claude / Codex — they act on it, not the user ───────
  //
  // This command doesn't run the mission itself. It outputs structured
  // instructions that the AI session (Claude Code or Codex) reads and acts on.
  // The AI then generates the mission file and runs it step by step.
  // ─────────────────────────────────────────────────────────────────────────────

  if (missionExists) {
    // Mission file already exists — tell the AI to load and run it
    console.log(`[CodeGuide] Mission ready: codeguide-out/missions/${topic}.md`);
    console.log("");
    console.log("INSTRUCTION FOR AI:");
    console.log(`Read the file codeguide-out/missions/${topic}.md in full.`);
    console.log("Then present Step 1 to the user exactly as written.");
    console.log("Wait for the user to respond before showing Step 2.");
    console.log("Follow the mission format precisely — one step at a time.");
    console.log("If the user asks a question, answer it with file references, then continue.");
  } else {
    // No mission yet — ask the AI to generate and immediately start it
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    console.log(`[CodeGuide] No mission found for "${topic}". Generating now.`);
    if (moduleContext) {
      console.log(`[CodeGuide] ${moduleContext}`);
    }
    console.log("");
    console.log("INSTRUCTION FOR AI:");
    console.log(`1. Use the following index to generate a mission about "${topic}".`);
    console.log(`2. Save it to codeguide-out/missions/${topic}.md`);
    console.log("3. Immediately start running the mission — present Step 1 to the user.");
    console.log("4. Do not summarise the whole mission upfront. Just show Step 1.");
    console.log("");
    console.log("MISSION FORMAT TO FOLLOW (from CLAUDE.md / AGENTS.md):");
    console.log("- Steps: learn → learn → task → verify → reflect");
    console.log("- Every step must cite specific files and line numbers from THIS codebase");
    console.log("- Tasks must reference existing files as patterns to follow");
    console.log("- 4-6 steps total. Concept check at the end of each learn step.");
    console.log("");
    console.log("INDEX CONTEXT:");
    console.log("---");
    // Only send the module map section, not the full file tree (token efficiency)
    const moduleMapSection = indexContent.split("## File tree")[0];
    console.log(moduleMapSection.slice(0, 6000)); // cap at ~6000 chars
    console.log("---");
  }
}
