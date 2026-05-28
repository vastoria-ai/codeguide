# CodeGuide

**Slash commands for learning any codebase — works in Claude Code, OpenAI Codex, Cursor, and more.**

CodeGuide indexes your repository into a structured set of markdown files, writes AI directives into your project, and registers `/codeguide` as a real slash command in Claude Code. Engineers use it to get a guided tour, run step-by-step learning missions, and ask codebase questions — all without burning tokens regenerating context each time.

---

## How it works

```
1. codeguide init    →  scans the repo, writes codeguide-out/ (INDEX.md, STRUCTURE.md, GRAPH_REPORT.md)
2. codeguide install →  appends CodeGuide directives to CLAUDE.md and AGENTS.md, registers the PreToolUse hook
3. /codeguide tour   →  Claude reads the committed index and gives a structured orientation — zero extra tokens
```

The index is committed to your repo. Every engineer on your team gets the same context on day one without regenerating it.

---

## Supported platforms

| Platform | How CodeGuide integrates |
|---|---|
| **Claude Code** | `CLAUDE.md` directive + PreToolUse hook + `/codeguide` slash command |
| **OpenAI Codex** | `AGENTS.md` directive |
| **Cursor** (agent mode) | `AGENTS.md` directive |
| **OpenCode** | `AGENTS.md` directive |
| **Factory Droid** | `AGENTS.md` directive |

> No LLM API key needed. CodeGuide is a static analysis tool — it reads your filesystem and writes markdown. The AI that reads the output is the one already running in your editor session.

---

## Install

```bash
npm install -g @vastoria-ai/codeguide
```

The `postinstall` script automatically registers `/codeguide` as a global slash command in Claude Code by writing `~/.claude/commands/codeguide.md`. No manual setup required.

---

## Setup (one time per project)

Run these three commands in your project root:

```bash
# 1. Write AI directives and install the PreToolUse hook
codeguide install

# 2. Index the repository
codeguide init

# 3. Verify everything is wired up correctly
codeguide doctor
```

Then commit the generated index so your whole team benefits:

```bash
git add codeguide-out/ && git commit -m "chore: add codeguide index"
```

---

## Slash command reference

Open a Claude Code or Codex session in your project and use any of these:

| Command | What it does |
|---|---|
| `/codeguide tour` | Structured orientation — project purpose, module map, 5 key files, 3 core concepts, suggested first mission |
| `/codeguide mission <topic>` | Step-by-step interactive learning mission. Generates and saves a mission file on first run, then walks you through it one step at a time |
| `/codeguide ask "<question>"` | Answers a codebase question with specific file paths and line numbers from the index |
| `/codeguide sync` | Re-indexes files changed since the last `codeguide init` |
| `/codeguide init` | Full re-index (run after major refactors) |

---

## CLI reference

All commands accept an optional `--dir <path>` flag to target a project outside the current directory.

| Command | Description |
|---|---|
| `codeguide install` | Write `CLAUDE.md`, `AGENTS.md` directives and `.claude/settings.json` PreToolUse hook |
| `codeguide init` | Scan the repo and write `codeguide-out/` |
| `codeguide sync` | Incremental re-index (falls back to full `init` if no manifest exists) |
| `codeguide doctor` | Check all artifacts are present and correctly configured |
| `codeguide hook-check` | Internal — called by the PreToolUse hook before every Grep/Glob/Read |

---

## Output directory — `codeguide-out/`

`codeguide init` writes four files:

| File | Purpose |
|---|---|
| `INDEX.md` | Full module breakdown — directories, purposes, key files, inter-module dependencies |
| `STRUCTURE.md` | Dependency graph and recommended reading order |
| `GRAPH_REPORT.md` | Compact summary Claude reads first for high-level context |
| `manifest.json` | Machine-readable metadata used by `codeguide sync` to detect changed files |
| `missions/` | Generated mission files are saved here so they persist across sessions |

**Commit this directory.** Token costs are paid once at index time. Every subsequent session reads from the committed files at zero extra cost.

---

## Mission example

Running `/codeguide mission auth` generates and immediately starts a mission like this:

```
Step 1 — Learn: How authentication is bootstrapped

Read: src/auth/index.ts lines 1-42

The auth module is initialized in bootstrapAuth() (line 12). It registers
three middleware layers: tokenParser, sessionValidator, and roleGuard.
tokenParser (line 18) extracts the JWT from the Authorization header and
attaches the decoded payload to req.user before any route handler runs.

Concept check: What happens if tokenParser receives a request with no
Authorization header? Trace the code path.
```

After you answer (or say "next"), CodeGuide moves to Step 2. The mission file is saved to `codeguide-out/missions/auth.md` so it resumes from where you left off in future sessions.

---

## Language support

| Language | Extensions |
|---|---|
| JavaScript / TypeScript | `.js` `.jsx` `.mjs` `.cjs` `.ts` `.tsx` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |
| Ruby | `.rb` |
| Java | `.java` |
| Kotlin | `.kt` |
| Swift | `.swift` |
| PHP | `.php` |
| C# | `.cs` |
| C / C++ | `.c` `.cpp` `.h` |
| Web | `.html` `.css` `.scss` `.vue` `.svelte` `.astro` |
| Config / Schema | `.json` `.yaml` `.yml` `.toml` `.prisma` `.graphql` `.sql` |
| Docs | `.md` `.mdx` `.txt` |
| Shell | `.sh` `.bash` `.zsh` |
| Named files | `Dockerfile` `Makefile` `Procfile` `.env.example` and more |

Files larger than 500 KB and common build/dependency directories (`node_modules`, `dist`, `.git`, etc.) are skipped automatically.

---

## Why no API key?

CodeGuide is a **static analysis CLI**, not an LLM wrapper. `codeguide init` reads your filesystem and writes markdown — no network calls, no tokens, no API keys. The AI intelligence comes entirely from the session (Claude Code, Codex, Cursor) that reads the output. This means:

- Works offline
- Zero ongoing cost per engineer
- No data leaves your machine during indexing
- Works with any model your editor session uses

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT
