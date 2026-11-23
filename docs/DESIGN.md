# BoundlessSky — design document

Status: draft, for iteration. Nothing here is a commitment. Anything marked **open** is an
undecided question, not an answer. Distinct changes wait until this document settles.

## 1. Purpose

BoundlessSky is a reproduction of Endless Sky — the same game, not a new one: the same
logic, dialogue, quests and systems, rebuilt in this repo.

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
  literal-enough port of the reference's code systems that the whole game works the same as
  the reference.
- **Phase 2 — 3D as an optional mode/module/mod.** Once the 2D game runs and matches the
  reference, add 3D presentation as an optional mode/module/mod layered on the 2D core.
  This is a layer over the 2D game, not a separate engine and not a rewrite. 3D is never
  load-bearing: the game must run fully in 2D, and 3D is the option to run it fully 3D.
- **Phase 3+ — 3D spacecraft and full 3D coverage.** 3D versions of the ships and their
  presentation, added after the 2D core is stable. The goal is a fully 3D mode that covers
  the same game — the optional full-3D mode, never a rewrite.

Why 2D first:

- A 2D reproduction is the baseline that proves the port is faithful — we compare it
  against the reference, which is right there in the submodule.
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
a relatively literal port of many of the reference's code systems. Ordered, each step
verified before the next begins:

1. **Baseline**: build the reference game from the submodule (CMake, per
   `endless-sky/docs/readme-developer.md`) and confirm it runs on Linux. This gives us the
   toolchain, the reference output, and the reference behavior to test against.
2. **Content load**: confirm the reference's data files (`data/`), artwork (`images/`),
   sounds (`sounds/`) and dialogue all load and play. This is the reference for what
   "works" means.
3. **Port the systems** — literal ports of the reference's code, one at a time, in roughly
   this order (dependency-first):
   - data loading (the indented text format and `DataFile`/`DataNode` parsing),
   - windowing/rendering, UI stack and panels,
   - audio (wav playback),
   - game data registry, world model (ships, bodies, systems),
   - mission/quest engine and dialog engine (`Mission.cpp`, `Conversation.cpp`, etc.),
   - flight/combat logic,
   - the rest of the UI (map, panels, menus).
   - Each port is verified against the reference at the same commit.
4. **Wire BoundlessSky to the same content**: serve the same data/images/sounds so that
   BoundlessSky runs the same game, not a re-skinned one.
5. **Ship the 2D game**: one binary that runs the full game, faithful to v0.11.4.

Done = all systems running, the full game behaving like the reference. No 3D, no polish
in this phase.

**Open — how literal the port must be.** See §9.

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

## 6. Repository layout

```
BoundlessSky/
├── README.md           — project overview
├── docs/
│   └── DESIGN.md       — this document
├── endless-sky/        — EndlessSky reference, as a git submodule (pinned, see §7)
└── (future) BoundlessSky source tree — the 2D port we build
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
  the same machine, and that the game's behavior still matches what we port — in 3D mode
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
| Quests | `data/` (mission definitions) + `source/Mission.cpp`-class logic | Same mission logic; ported in Phase 1 |
| Source code | `endless-sky/source/` | Reference for the literal ports |
| Tests | `endless-sky/tests/` | Unit + integration; kept for comparison |

Migration: in Phase 1, the content is **served from the submodule** (not copied). A copy
into `BoundlessSky/content/` is only for the 3D phase or if we outgrow the read-only
submodule — **open** (see §9).

## 9. Open questions (for iteration — decide before distinct changes)

1. **How literal the port is.** *Option A* — build BoundlessSky as a fork of the reference
   engine (light changes, same layout). *Option B* — re-implement in our own codebase,
   porting systems one at a time, keeping behavior identical. Option A is the fastest path
   to a running faithful game; Option B gives us clean ownership of what we recreate.
   The Phase 1 procedures above are written to work with either. Recommendation: Option A or
   a hybrid — build the reference, run it, and port in BoundlessSky, keeping one source of
   truth (see decision log).
2. **Engine/stack for the BoundlessSky build.** C++ + CMake (same as the reference; SDL2/SDL3,
   OpenGL) vs. a 2D game engine (Godot, etc.). This decides the entire build — open, do not decide before
   1–2 settle.
3. **Where BoundlessSky's own build lives.** Separate app in this same repo (e.g. `app/` or
   `src/`) vs. its own repo with the submodule as a read-only checkout. Open.
4. **Submodule update cadence.** Every stable release, or on demand. Open (leaning on demand:
   we only bump when the reference changes something we care about).
5. **Outer repo license.** The reproduction of the reference's logic is GPL-3.0 (it is
   derived code); artwork is public domain or CC — mixed. The outer repo needs an explicit
   LICENSE before release; not decided here. Must land before any distribution.
6. **Platforms.** Linux now; Windows and macOS how soon. Open.
7. **3D content pipeline.** Ship models: generated or hand-modeled; how 3D fits the same
   missions/data. Open — do not decide in Phase 1.
8. **Testing strategy.** Compare BoundlessSky against the reference (behavior diff on a
   fixed set of scenarios) vs. port the reference's own tests. Open.
9. **Artwork/sounds distribution.** The reference ships everything; BoundlessSky serves the
   same files from the submodule. Fine as long as we keep the reference layout — open.

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
| 2026-11-23 | Scope is the procedures to get the game running in its most basic setup — a relatively literal port of many code systems. |
| 2026-11-23 | Reference: `endless-sky/endless-sky` submodule, pinned to v0.11.4 (latest stable, 2026-10-31). Never edit in place; update as releases come. |
| 2026-11-23 | Sound effects, artwork and dialogue are supported in full, from Phase 1. |
| 2026-11-23 | Complete parity is the ideal: BoundlessSky reproduces the entire game, so submodule updates can be applied and the game kept working — re-verify and keep, not keep-and-hope. |
| 2026-11-23 | 3D is optional: the player chooses fully 2D or fully 3D; 3D never changes gameplay and is never a rewrite. |
