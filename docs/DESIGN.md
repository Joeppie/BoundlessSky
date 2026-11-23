# BoundlessSky — design document

Status: draft, for iteration. Nothing here is a commitment. Anything marked **open** is an
undecided question, not an answer. Distinct changes wait until this document settles.

## 1. Purpose

BoundlessSky is a reproduction of Endless Sky — the same game, not a new one: the same
logic, dialogue, quests and systems. The engine is **re-implemented in TypeScript**
(statically compiled, not webassembly) — not a fork of the reference's C++ engine.
It renders with **Three.js on a canvas**; shaders are used for special effects, but the
first milestones are sprites only. See [SCAFFOLD.md](SCAFFOLD.md) for the
implementation list.

BoundlessSky started as a 3D recreation of the engine. The direction changed (2026-11-23):
the first version is a **faithful 2D reproduction of the entire game**, and the 3D presentation
is added later as a mode/module/mod on top of the 2D core — not a rewrite.

The target is **complete parity**: everything the reference game does, BoundlessSky does.
Parity is what makes the submodule workflow meaningful — when we update the pin to a newer
stable release, we re-verify and keep the game working, because we reproduce the whole game
and not a slice of it.

## 2. Direction: 2D first, 3D later

Owner direction, 2026-11-23:

- **Phase 1 — faithful 2D reproduction.** Get the game running in its most basic setup: a
  faithful re-implementation of the reference's systems — same behavior, same content —
  with the whole game working the same as the reference.
- **Phase 2 — 3D as an optional mode/module/mod.** Once the 2D game runs and matches the
  reference, add 3D presentation as an optional mode/module/mod layered on the 2D core.
  This is a layer over the 2D game, not a separate engine and not a rewrite. 3D is never
  load-bearing: the game must run fully in 2D, and 3D is the option to run it fully 3D.
- **Phase 3+ — 3D spacecraft and full 3D coverage.** 3D versions of the ships and their
  presentation, added after the 2D core is stable. The goal is a fully 3D mode that covers
  the same game — the optional full-3D mode, never a rewrite.

Why 2D first:

- A 2D reproduction is the baseline that proves the re-implementation is faithful — we
  compare it against the reference, which is right there in the submodule.
- Complete parity is what makes the update path safe: bumping the submodule to a newer
  stable release must keep the game working, and the only way to prove that is a game that
  reproduces the whole game, not a slice of it.
- 3D as an optional mode/module/mod keeps the gameplay core identical to the 2D one and
  avoids rewriting logic per presentation.

## 3. Faithfulness contract

Everything the reference game does, BoundlessSky does — same rules, same content:

- **Logic and systems** — game loop, ship movement and combat, missions, minimaps, map
  and flight logic, dialog handling: same behavior, same inputs and outputs. A visible
  difference is a bug or a documented deliberate deviation (this document).
- **Dialogue** — the same text, same choices, same flow. The reference's data files are the
  source; we reproduce them as-is.
- **Quests** — the same missions and events, with the same triggers, conditions and
  rewards.
- **Artwork** — all of `images/`: sprites, asteroids, effects, ship parts, UI icons, in full.
- **Sound effects** — all of `sounds/` (wav effects plus `ui/` and `ambient/`), in full.
- **Everything else** — factions, outfits, ship definitions, maps, start/landing/shipyard
  flows — carried over in full, not trimmed to a subset.

Anything that changes the game's behavior (new dialogue, new quests, changed balance) is
beyond "faithful reproduction". Every such change is documented in §10 and confirmed before
it lands.

## 4. Scope — Phase 1 procedures

The initial scope is **the procedures to get the game running in its most basic setup** —
a faithful re-implementation of many of the reference's systems, in TypeScript. Ordered, each step
verified before the next begins:

1. **Baseline**: build the reference game from the submodule (CMake, per
   `endless-sky/docs/readme-developer.md`) and confirm it runs on Linux. This gives us the
   toolchain, the reference output, and the reference behavior to test against.
2. **Content load**: confirm the reference's data files (`data/`), artwork (`images/`),
   sounds (`sounds/`) and dialogue all load and play. This is the reference for what
   "works" means.
3. **Re-implement the systems** — in TypeScript, one at a time, in roughly this order
   (dependency-first). These are fresh implementations that match the reference's
   behavior, not copies of the reference's C++:
   - data loading (the indented text format and `DataFile`/`DataNode` parsing),
   - windowing/rendering, UI stack and panels,
   - audio (wav playback),
   - game data registry, world model (ships, bodies, systems),
   - mission/quest engine and dialog engine (`Mission.cpp`, `Conversation.cpp`, etc.),
   - flight/combat logic,
   - the rest of the UI (map, panels, menus).
   - Each re-implementation is verified against the reference at the same commit.
4. **Wire BoundlessSky to the same content**: serve the same data/images/sounds so that
   BoundlessSky runs the same game, not a re-skinned one.
5. **Ship the 2D game**: one app that runs the full game, faithful to v0.11.4.

Done = all systems running, the full game behaving like the reference. No 3D, no polish
in this phase.

**Resolved — the re-implementation is not a copy of the reference's C++.** See §11.

## 5. 3D later — mode/module/mod

Phase 2 changes the presentation, not the game. 3D is **optional**, not a rewrite:

- 3D is a **mode/module/mod**: a layer over the 2D core that changes how the scene and
  spacecraft are presented. The 2D game stays the gameplay baseline.
- The player chooses: **fully 2D** (the game as it always runs) or **fully 3D** (the same
  game, fully presented in 3D). 3D is never load-bearing — the game runs without it.
- Coverage grows in stages: ships first, then ship-related visuals. Other presentations
  (asteroid/planet views) are **out of scope** initially — **open**.
- Completing 3D means the optional mode covers the whole game at the same parity level as
  2D; until then, the 3D mode is partial by design, and the 2D mode remains the
  complete baseline.
- 3D spacecraft artwork: generated or modeled per the reference's ships, later — **open**
  (see §9). How 3D is toggled (startup flag, preference, in-game switch) is **open**.
- Asteroid and ship rendering (see §8): initially reuse 2D sprites with our own rotation.
  A simple 3D-rendered sprite for asteroids — and, eventually, for the ships — is a later
  concern, not Phase 1 or 2 scope.

## 6. Repository layout

```
BoundlessSky/
├── README.md           — project overview
├── docs/
│   └── DESIGN.md       — this document
├── endless-sky/        — EndlessSky reference, as a git submodule (pinned, see §7)
└── (future) BoundlessSky app — the TypeScript engine + the re-implemented systems (layout convention: open)
```

## 7. Submodule workflow

- `endless-sky/` is a git submodule of
  `https://github.com/endless-sky/endless-sky.git`, pinned to the latest stable release.
- **Pinned at v0.11.4** (2026-10-31; commit `406661ebc4920816d02ac66e7e89e18554cfe0c8`),
  the latest stable release as of 2026-11-23.
- **Never edit the submodule in place.** The reference is read-only: it is the comparison
  baseline and the source of all content. Our changes live in this repo.
- **Update cadence**: when a new stable release lands we want, checkout the new tag
  inside `endless-sky/`, commit the new commit SHA in the outer repo, and re-verify the game
  (build, run, behavior) before keeping it. The submodule SHA is recorded in the outer
  repo, so every checkout of BoundlessSky is byte-identical against the reference.
- **Verifying updates**: at each pin bump, confirm the reference still builds and runs on
  the same machine, and that the game's behavior still matches what we re-implement — in 3D mode
  too, once 3D exists. Complete parity is the point: a pin bump that breaks the game is
  caught and rolled back, not kept.

## 8. Content and assets

Everything the reference ships, we carry over in full:

| Content | Location | Notes |
|---|---|---|
| Game data files | `endless-sky/data/` | Indented text format; per-faction subfolders; `_ui/` for menus, messages, tooltips |
| Artwork | `endless-sky/images/` | Sprites (ships, asteroids, bodies, effects, planets…), UI icons |
| Sound effects | `endless-sky/sounds/` | `.wav` effects, plus `sounds/ui/` and `sounds/ambient/` |
| Dialogue | embedded in `data/**/*.txt` | Missions, conversations, events — same text and flow |
| Quests | `data/` (mission definitions) + `source/Mission.cpp`-class logic | Same mission logic; re-implemented in Phase 1 |
| Source code | `endless-sky/source/` | Reference for the re-implementations |
| Tests | `endless-sky/tests/` | Unit + integration; kept for comparison |

Migration: in Phase 1, the content is **served from the submodule** (not copied). A copy
into `BoundlessSky/content/` is only for the 3D phase or if we outgrow the read-only
submodule — **open** (see §9).

Rendering notes:

- **Asteroids.** The reference ships ~54–60 pre-rotated spin-stage PNGs per asteroid class
  (e.g. `images/asteroid/iron/spin-00.png` … `spin-59.png`) and picks a stage per frame.
  We do not re-use that: we rotate a single sprite ourselves, at draw time — Three.js
  rotates sprites via texture transforms, so the many-stage PNG sets are dead weight.
- **Ships and other sprites.** Reuse the 2D sprites as-is for what is needed in Phase 1
  (ships, bodies, effects, UI icons). Rotating them by us is the same approach as asteroids.
- **Later concern.** Asteroids — and eventually the ships — may be drawn as a simple
  3D-rendered sprite (a low-cost fake-3D that bakes one rotated view per frame). This is
  not Phase 1 or 2 scope; it is recorded here so the 2D sprites are not baked in forever.

## 9. Open questions (for iteration — decide before distinct changes)

Resolved — see the decision log (§11): the re-implementation is in TypeScript;
the engine is re-implemented (not a fork of the reference's C++); the app lives in this
repo; the renderer is Three.js on a canvas (sprites initially, shaders later). The
following are open:

1. **Runtime target.** What the statically compiled TypeScript builds into: a browser
   app, a desktop app (native, Electron/Tauri-class), both — the build is settled, the
   target is not. This decides packaging and distribution, not the engine.
2. **App layout convention.** Where the app source lives in this repo (e.g. `src/`,
   `app/`), and how it is wired to the submodule's content. Open.
3. **3D toggle mechanism.** Startup flag, preference, in-game switch — open (3D phase).
4. **3D content pipeline.** Ship models: generated or hand-modeled; how 3D fits the same
   missions/data; when asteroid/ship 3D-rendered sprites replace the 2D sprites. Open —
   do not decide in Phase 1.
5. **Outer repo LICENSE.** The engine is a fresh TypeScript re-implementation, not a
   derivation of the reference's C++. The artwork, sounds and dialogue come from the
   reference and carry its licenses (artwork public domain or CC; the reference's code is
   GPL-3.0). We need an explicit LICENSE before any distribution — not decided here.
6. **Submodule update cadence.** Every stable release, or on demand. Open (leaning on
   demand: we only bump when the reference changes something we care about).
7. **Platforms.** Linux now; Windows and macOS how soon. Open.
8. **Testing strategy.** Compare BoundlessSky against the reference (behavior diff on a
   fixed set of scenarios) vs. port the reference's own tests. Open.
9. **Artwork/sounds distribution.** The reference ships everything; BoundlessSky serves
   the same files from the submodule. Fine as long as we keep the reference layout —
   open.

## 10. Deliberate changes (deviation log)

Anything in this section must be confirmed against this document before it lands, since
it changes the game's behavior:

| Change | Why | Status |
|---|---|---|
| (none yet) | — | — |

## 11. Decision log

| Date | Decision |
|---|---|
| 2026-11-23 | BoundlessSky is a reproduction of the Endless Sky game — same logic, dialogue, quests, systems — not a new game. |
| 2026-11-23 | Phase 1 = a faithful 2D reproduction of the entire game. 3D is added later as a mode/module/mod, not a rewrite. |
| 2026-11-23 | Scope is the procedures to get the game running in its most basic setup — a faithful re-implementation of many code systems. |
| 2026-11-23 | Reference: `endless-sky/endless-sky` submodule, pinned to v0.11.4 (latest stable, 2026-10-31). Never edit in place; update as releases come. |
| 2026-11-23 | Sound effects, artwork and dialogue are supported in full, from Phase 1. |
| 2026-11-23 | Complete parity is the ideal: BoundlessSky reproduces the entire game, so submodule updates can be applied and the game kept working — re-verify and keep, not keep-and-hope. |
| 2026-11-23 | 3D is optional: the player chooses fully 2D or fully 3D; 3D never changes gameplay and is never a rewrite. |
| 2026-11-23 | Engine is re-implemented in TypeScript, statically compiled — not webassembly, not the reference C++ engine reused. |
| 2026-11-23 | The app lives in this repo; the submodule stays the read-only reference; BoundlessSky serves the same content from it. |
| 2026-11-23 | Artwork: 2D sprites reused initially (asteroids and ships included) for what is needed. Asteroids/ships are rotated by us at draw time — the reference's per-rotation spin-stage PNG sets are not re-used. Asteroid and ship 3D-rendered sprites are a later concern. |
| 2026-11-23 | Renderer: Three.js on a canvas, with shaders reserved for special effects. Initially sprites only — no custom shaders. Later: 3D models → a full 3D mode or a pseudo-2D mode (classical gameplay loop intact). |
| 2026-11-23 | Code organized like the reference (same module names, same responsibilities), with an implementation list in [SCAFFOLD.md](SCAFFOLD.md); Milestone 1 = parsing, dialogue, ship selection, the planet menu. |
