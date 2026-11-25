# Reconciliation — the archived branch `archive/feat-planet-menu-loop` vs. main

Date: 2026-11-24/25. This document is the record of what happened when the
the unmerged work on the archived branch `archive/feat-planet-menu-loop` was reconciled with main, and it is
the standing rule for the next time.

## What happened

Local main (`80dbe18`, three commits ahead of origin/main) had been advanced
in parallel by another session: "Fill the reference screens" (`9ffabdc`) plus
the limits doc (`80dbe18`). That work replaced the architecture this branch
was built on — a 3D persistent `FlightView` (`src/render/FlightScene.ts`,
`src/ui/FlightView.ts`) — with main's SVG `FlightScreen`, `CornerHud`,
`PlayerInfoScreen`, `FlightSim`, a browsing-only `OutfitterScreen`, and a
screen-per-view flow.

The two never met. The branch at `archive/feat-planet-menu-loop` carried its own
flight view, fight, mining, four planet-loop panels, a save system, and its
own e2e/docs — ~9k lines across ~55 files, including paths that both sides
modified (`Game.ts`, `style.css`, `ShipyardScreen.ts`, `PlanetMenuScreen.ts`,
`OutfitterScreen.ts`, `Ship.ts`, `Date.ts`, `PlayerInfo.ts`, `Account.ts`,
`Audio.ts`, `MenuScreen.ts`, `Panel.ts`, `Background.ts`, `e2e/*.spec.ts`,
`src/ui/ArrivalScreen.ts` (deleted on the branch — main kept it)). A naive
merge would have produced two flight views and ~20 conflicting files.

## What was NOT ported and why

Everything below is intentionally left out of main. It is not a bug or a
shortcoming to fix here — it is a scope/architecture call.

- **The 3D persistent flight view** (`FlightView`/`FlightScene`) — main
  deliberately uses an SVG flight view (`src/ui/FlightScreen.ts`) because the
  reference has no continuous in-system flight mode and Milestone 2 uses a
  simplified model on top of the same data. Bringing three "flight view"
  implementations together would be a worse port than the worktree had.
- **Fight / mining laser / asteroid mining loop** — main has no weapons and no
  ammo model (documented in `docs/LIMITS.md`). Fight/harvest is a Milestone 3
  concern, not a merge artifact.
- **Planet-loop panels** (Bank / Trade / Port / Job Board / Hire Crew / Info) —
  main hides these deliberately ("Unimplemented panels are hidden"); the
  worktree implemented them with a full credit economy, which is a scope
  expansion, not a parity fix. Worktrees changes here belong to that milestone,
  not to a merge.
- **Save / load** — main deliberately persists nothing across reloads
  (`docs/LIMITS.md`). The save system is a deliberate milestone-2+ feature,
  not a fix.
- **Outfitter category groups** — main's outfitter is already category-organized
  with details (`docs/LIMITS.md`: browsing only, no install button). The
  worktree's grouping was a duplicate of what main already does.
- **Static-sprite fallback** — not applicable. Main's flight view and outfitter
  show **thumbnails** (`thumbnail/<name>.png`) and a mirrored `ship`
  sprite shape, never the `=N.png` frame convention of the reference — so the
  worktree's static-sprite bug does not exist on main.
- **Background-loop pause while flying** — not applicable. Main's background
  (900-star loop) is the designed ambience behind the menu/flight view; the
  worktree's problem (two full-screen canvases) does not exist in main (SVG
  scene over one background). Measured: ~16.6 ms average frame, headless
  Chromium, 5 s window — nothing hot.
- **Performance doc (numbers)** — not portable. The numbers describe the
  worktree's 3D view, not main's SVG view. Main's own measurement is in this
  document (16.6 ms avg, 16.7 p50, 16.9 p95, 301 samples, headless Chromium,
  real screen after the report below).
- **`package.json` dev address / `--strictPort`** — ported (see below).

## What WAS ported to main

- `--strictPort` on the dev and preview servers (fail loudly rather than
  silently fall to a different port over Tailscale, where the URL must not
  move).
- The measurement discipline: numbers over vibes. Main's flight view measures
  ~16.6 ms average / ~16.7 ms p50 / ~16.9 ms p95 / ~18.2 ms max over a 5 s
  window, 301 frames, headless Chromium, real flow (menu → picker → naming →
  conversation → arrival → shipyard → quest → planet menu → Depart). Nothing
  in the flight view approaches the headless vsync cap — the view is cheap.
  A real-GPU measurement on the owner's box remains unverifiable from here;
  if you see jank, the suspects are the 900-star loop + the SVG repaint, not
  the plane/SVG math.
- The commit record (this document) so the branch trap is documented the next
  time it occurs.

## How to prevent this (standing rule)

The trap is this shape: a session lives in a worktree, gets a branch, builds
a parallel architecture, and main advances without it. The next session finds
a 55-file, ~9k-line divergence that cannot be merged mechanically.
Prevention, in order:

1. **New work = new session.** New features, new screens, new architecture —
   give it its own session with fresh context, not a new branch on this
   session's worktree. The owner wants new sessions to carry the new work.
2. **Worktrees are for isolated work, not milestone tracking.** A worktree is
   for parallel/isolated tasks that must not disturb the checked-out
   architecture. A whole milestone is not that. The worktree is the
   exception; main's checkout is the default.
3. **One architecture per milestone.** If main has moved, port the useful
   bits onto main's architecture (this document's method) — never a parallel
   rebuild that then needs reconciliation.
4. **Never silently force-merge two architectures.** If a branch cannot merge
   cleanly: re-port the useful bits, or stop and ask.
5. **Archive stale branches visibly.** A branch built on a stale checkout is
   renamed (`archive/<name>`), not left as if it were live. The archived
   branch keeps the commits as a record; nothing is lost, but it cannot
   pretend to be the next branch.

## Standing rule

One architecture per milestone. New work lands on main (or on a branch that
re-verifies against main before merging); it does NOT get built in a parallel
architecture that then needs a 60-file reconciliation. If a branch cannot
merge cleanly, either re-implement the useful bits on main (this document's
method) or, at minimum, stop and ask. Do not silently force-merge.

## Known gaps kept deliberately

- No weapons / ammo / mining — Milestone 3+.
- No full main-menu panel on Escape — `Escape` aborts the flight view back to
  the planet menu (the reference pushes a MenuPanel; that is a later milestone).
- Real-GPU performance still unmeasured; headless numbers only.
