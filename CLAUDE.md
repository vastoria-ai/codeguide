# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

Codeguide is a CLI tool that analyzes a codebase and generates structured documentation (INDEX.md, STRUCTURE.md, GRAPH_REPORT.md) designed to help AI assistants (Claude Code, OpenAI Codex, Cursor) understand and navigate unfamiliar codebases. It also writes CLAUDE.md/AGENTS.md directives and installs a PreToolUse hook into `.claude/settings.json` that tells Claude Code to consult the generated index before running Grep/Glob/Read.

## Commands

```bash
npm run build         # compile TypeScript to dist/
npm run dev           # run CLI from source via tsx (no build needed)
npm run lint          # type-check only (tsc --noEmit)
npm run format:check  # check formatting with Prettier
npm run format:write  # auto-format with Prettier
npm test              # run all tests once
npm run test:watch    # run tests in watch mode

# Run a single test file
npx vitest __tests__/indexer/scanner.test.ts
```

## Architecture

The project has four layers:

**1. Indexer (`src/indexer/`)** — The core engine, three files in a pipeline:
- `scanner.ts` — Walks the filesystem, filters by `CODE_EXTENSIONS`, skips `IGNORE_DIRS` and files >500KB. Returns `ScannedFile[]` with paths, extension, and size.
- `modules.ts` — Groups scanned files into logical `Module[]` by matching directory names against `MODULE_DIR_SIGNALS` (auth, payments, components, etc.) and inferring file roles from filename patterns (service, controller, handler, router, etc.). Also parses static imports to build inter-module dependency graphs.
- `markdown.ts` — Consumes modules and produces three documents: `INDEX.md` (full module breakdown), `STRUCTURE.md` (dependency graph + reading order), `GRAPH_REPORT.md` (compact summary). Also reads `package.json` and `README.md` to include project context.

**2. Commands (`src/commands/`)** — One command implemented so far:
- `install.ts` — Writes CLAUDE.md and AGENTS.md directives using `appendIfMissing()` to avoid duplication, then deep-merges a PreToolUse hook into `.claude/settings.json`.

**3. Utilities (`src/utils/fs.ts`)** — File system helpers used across the project: `appendIfMissing`, `deepMerge`, `appendToGitignore`, `ensureDir`, `readJsonFile`/`writeJsonFile`, and path helpers `getOutDir`/`getMissionsDir`.

**4. CLI (`src/bin/cli.ts`)** — Entry point using `commander`. Registers all commands; most are stubs pending implementation (init, sync, mission, tour, ask, hook-check, doctor).

**Data flow:**
```
scanRepo() → detectModules() → buildIndexMarkdown() / buildStructureMarkdown() / buildGraphReport()
                                          ↓
                             install command writes CLAUDE.md, AGENTS.md, .claude/settings.json
```

## Testing Conventions

Tests live in `__tests__/` mirroring `src/` structure. Key patterns:
- Use `fs.mkdtempSync()` to create isolated temporary directories per test; clean up in `afterEach`.
- Helper functions (`touch`, `file`, `makeFile`) create fixture files inline.
- Spy on `console.log` with `vi.spyOn` rather than suppressing output globally.
- Test files use `.test.ts` extension (not `.spec.ts`).

## TypeScript & Style

- ESM project: `"type": "module"` in package.json; imports must include `.js` extension even for `.ts` source files.
- Strict mode enabled. No `any` types.
- Constants in `UPPER_CASE`, functions in `camelCase` with verb prefix (`scanRepo`, `buildFileTree`).
- Prettier config: 100-char line width, 2-space indent, double quotes, trailing commas (ES5).


---

## CodeGuide — codebase learning

A structured codebase index lives in `codeguide-out/`.

### Before answering any architecture or "how does X work" question:
1. Read `codeguide-out/INDEX.md` — it maps every module with key files
2. Read `codeguide-out/STRUCTURE.md` for the dependency graph
3. Reference specific files and line numbers in answers — never generic advice
4. Only grep raw source files if the index doesn't answer the question

### Slash commands available in this session:
| Command | What it does |
|---|---|
| `/codeguide init` | Re-index this repository (run after major refactors) |
| `/codeguide tour` | Give a structured orientation of this codebase |
| `/codeguide mission <topic>` | Run a step-by-step interactive learning mission |
| `/codeguide ask "<question>"` | Answer a question using the index |
| `/codeguide sync` | Incrementally update the index for changed files |

### Running a mission — follow this format exactly:
When `/codeguide mission <topic>` is run:
1. Check if `codeguide-out/missions/<topic>.md` exists
2. If yes: load it and start from Step 1
3. If no: generate the mission file using the index, save it, then start Step 1
4. **Present one step at a time.** Wait for the user to say "done", "next",
   or ask a question before showing the next step
5. When the user asks a question mid-mission: answer it with file references,
   then offer to continue with the current step
6. Never skip steps. The pacing is the learning
7. After the final step: suggest a follow-up mission from GRAPH_REPORT.md

### Generating a mission file — use this structure exactly:
```markdown
# Mission: <Title>

Generated for: <project> | Topic: <topic>

## Overview
<2-3 sentences about how <topic> works specifically in THIS codebase.
Reference actual file paths.>

## Steps

### Step 1 — Learn: <concept>
**Read:** `<file path>` lines <N>-<M>
<Explanation referencing specific functions, variables, and patterns from the code.>

**Concept check:** <A question to confirm understanding before moving on.>

---

### Step 2 — Learn: <next concept>
...

### Step N — Task: <something to build or modify>
<Specific task. Reference existing files as patterns to follow.>
**Hint:** <Hint for when they get stuck.>

---

### Step N+1 — Verify: <check understanding>
<A question or small challenge that confirms they understood the task.>

---

### Reflect
You now understand:
- <bullet 1>
- <bullet 2>

**Next mission:** `/codeguide mission <related-topic>`
```

---
