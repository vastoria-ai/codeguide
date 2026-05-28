# Contributing to CodeGuide

Thanks for your interest. This document covers everything you need to go from zero to a working PR.

---

## Local development setup

**Prerequisites:** Node.js 18+, npm 9+

```bash
git clone https://github.com/vastoria-ai/codeguide.git
cd codeguide
npm install
```

Run commands directly from source (no build step needed):

```bash
npm run dev -- <command>

# Examples
npm run dev -- init
npm run dev -- install
npm run dev -- doctor
```

Build the TypeScript to `dist/` when you want to test the compiled output:

```bash
npm run build
node dist/bin/cli.js init
```

Type-check without emitting:

```bash
npm run lint
```

Format code:

```bash
npm run format:write   # auto-fix
npm run format:check   # check only (used in CI)
```

---

## Running tests

```bash
npm test                          # run all tests once
npm run test:watch                # watch mode

# Run a single test file
npx vitest __tests__/commands/init.test.ts
```

All tests use real temporary directories (`fs.mkdtempSync`) — no mocking the filesystem. If you add a command, add a matching test file in `__tests__/commands/`.

---

## Testing commands against a real repo

The fastest feedback loop is to run commands against this repo itself, since it already has a codebase:

```bash
# Index this repo
npm run dev -- init

# Check everything is wired up
npm run dev -- doctor

# Open a Claude Code session and try the slash commands
```

To test against a different project:

```bash
npm run dev -- init --dir /path/to/other/project
npm run dev -- install --dir /path/to/other/project
```

To test the global slash command registration (postinstall behaviour):

```bash
node scripts/postinstall.js
cat ~/.claude/commands/codeguide.md
```

---

## Project structure

```
src/
  bin/cli.ts          — CLI entry point (commander)
  commands/           — One file per command
    init.ts           — codeguide init
    install.ts        — codeguide install
    tour.ts           — tour, ask, hook-check, sync, doctor (implementations)
    ask.ts            — re-export shim
    sync.ts           — re-export shim
    doctor.ts         — re-export shim
    hookCheck.ts      — re-export shim
    mission.ts        — codeguide mission
  indexer/
    scanner.ts        — walks the filesystem, returns ScannedFile[]
    modules.ts        — groups files into Module[] by directory signals
    markdown.ts       — builds INDEX.md, STRUCTURE.md, GRAPH_REPORT.md
  utils/fs.ts         — shared filesystem helpers

__tests__/            — mirrors src/ structure, .test.ts extension
scripts/
  postinstall.js      — writes ~/.claude/commands/codeguide.md on npm install
```

---

## PR guidelines

- **One logical change per PR.** A new command, a bug fix, a docs update — not all three.
- **Tests required for new commands.** Every command in `src/commands/` must have a matching `__tests__/commands/*.test.ts` file. See the existing test files for the expected pattern.
- **No snapshot tests.** We test behaviour (file exists, output contains string), not exact output formatting.
- **Run before pushing:**
  ```bash
  npm run lint && npm test && npm run format:check
  ```
- **Commit messages:** Use the conventional format — `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Keep the subject line under 72 characters.
- **PR description:** Use `/pr-description` in your Claude Code session to generate one, or follow the template:
  - Summary bullets (what changed and why)
  - Test plan checklist

---

## Issue labels

| Label | Meaning |
|---|---|
| `bug` | Something is broken — include the command you ran, the error output, and your Node version |
| `enhancement` | New feature or improvement to an existing command |
| `new-language` | Request to add support for a language or file extension not in the current scanner |
| `docs` | Documentation gap or inaccuracy |
| `good first issue` | Well-scoped change suitable for a first contribution — usually a new language in `scanner.ts` or a missing test |
| `help wanted` | Maintainers want outside input before deciding on approach |

When filing a bug, always include the output of:

```bash
codeguide doctor
node --version
```

---

## Adding a new language

Language support lives in `src/indexer/scanner.ts` in the `CODE_EXTENSIONS` set. To add a language:

1. Add the extension(s) to `CODE_EXTENSIONS` under the appropriate comment group.
2. Add a test case in `__tests__/indexer/scanner.test.ts` that verifies files with the new extension are included in `scanRepo()` output.
3. Update the language table in `README.md`.

That's it — the rest of the pipeline (modules, markdown) picks up new extensions automatically.

---

## Release process (maintainers)

1. Bump `version` in `package.json`.
2. Update `CHANGELOG.md` (if present).
3. `npm run build`
4. `npm publish`

The `postinstall` script runs automatically for all consumers on `npm install`.
