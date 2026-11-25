# BoundlessSky — AGENTS.md

A faithful re-implementation of **Endless Sky v0.11.4** in TypeScript. See
[README.md](README.md) and [docs/DESIGN.md](docs/DESIGN.md).

## Commands

- `npm run dev` — dev server on 0.0.0.0:5173 (served to the owner over Tailscale)
- `npm run typecheck` — `tsc --noEmit`
- `npx vitest run` — unit tests (Vitest)
- `npm run build` — production build

## Branch discipline

One architecture per milestone: do not build a parallel copy of a screen or the
flight view in a separate branch. If main has moved, port the useful bits onto
main's architecture (see `docs/RECONCILIATION.md`) — do not force-merge two
architectures. New code is verified against main before it merges.

New work gets a new session — fresh context, not a new branch on the previous
session's worktree. A worktree is for isolated work, not milestone tracking.
Stale branches are archived (`archive/<name>`), never left looking live.

## Hard rules

- **Credential sweep before committing.** Nothing that shouldn't be committed
  may land in the repository: no API keys, tokens, passwords, private keys
  (`*.pem`, `*.key`), `.env` files or secrets directories, and no credential
  material pasted into source, docs or tests. Before committing, sweep the
  diff with a grep for these and for anything that smells like a secret
  (tokens, `api_key`, `password`, `secret`, `token`, `BEGIN/END ... KEY`); if
  anything is found, stop and handle it instead of committing.
- **Run the TypeScript unit tests before committing.** `npx vitest run` must
  pass (together with `npm run typecheck`). Do not commit red tests.
- **The endless-sky/ submodule is read-only.** Never edit it in place —
  content, data, images and sounds are served from it via the dev-server
  `/content/*` middleware and are never copied into this repo.
- **TypeScript only — no Python.**
- **Milestone 1 scope** (see docs/SCAFFOLD.md): parsing → dialogue → ship
  selection → planet menu. World/ships/planets are out of scope.
- **No privilege escalation, no touching system services** — the desktop is the
  owner's; workspace only.

## Tests

Behavior is verified against the reference implementation, not by feel:

- `src/**/*.test.ts` (Vitest) — ported from the reference's `tests/unit/src/*.cpp`
  (see the "Tests mirror" notes in each file). Keep tests at the class
  behavior level: state, fields, conditions — not trivial internals.
- The reference data file (`endless-sky/data/starts.txt`) is the expected-output
  oracle for the start flow tests. Load it, don't invent scenarios.
