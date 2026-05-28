#!/usr/bin/env node
import { Command } from "commander";

import { installCommand } from "../commands/install.js";
import { initiCommand } from "../commands/init.js";
import { missionCommand } from "../commands/mission.js";
import { tourCommand } from "../commands/tour.js";
import { syncCommand } from "../commands/sync.js";
import { askCommand } from "../commands/ask.js";
import { doctorCommand } from "../commands/doctor.js";
import { hookCheckCommand } from "../commands/hookCheck.js";

const program = new Command();

program
  .name("codeguide")
  .description("Codebase learning slash commands for Claude Code and OpenAI Codex sessions")
  .version("0.1.0");

program
  .command("install")
  .description("Set up CodeGuide in this project (writes CLAUDE.md, AGENTS.md, hooks")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => installCommand(opts.dir));

program
  .command("init")
  .description("Index this repository and write codeguide-out/")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => initiCommand(opts.dir));

program
  .command("sync")
  .description("Incrementally re-index changed files")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => syncCommand(opts.dir));

program
  .command("mission <topic>")
  .description("Start an interactive learning mission on a topic")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((topic, opts) => missionCommand(topic, opts.dir));

program
  .command("tour")
  .description("Get a guided orientation of this codebase")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => tourCommand(opts.dir));

program
  .command("ask <questions>")
  .description("Ask as question about this codebase")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((question, opts) => askCommand(question, opts.dir));

program
  .command("hook-check")
  .description("PreToolUse hook - notifies Claude if an index exists (internal use)")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => hookCheckCommand(opts.dir));

program
  .command("doctor")
  .description("Check that CodeGuide is correctly installed in this project")
  .option("-d, --dir <path>", "project directory", process.cwd())
  .action((opts) => doctorCommand(opts.dir));

program.parse();
