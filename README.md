# BoundlessSky

A faithful reproduction of the Endless Sky game: same logic, dialogue, quests and
systems. The engine is re-implemented in TypeScript (statically compiled — not
webassembly, not the reference's C++ engine), rendering with Three.js on a canvas
(sprites initially; shaders for special effects later).

The project starts as a faithful 2D reproduction of the entire game — complete parity:
everything the reference game does, BoundlessSky does. A 3D presentation is added later
as an optional mode/module/mod layered on the 2D core — never load-bearing, never a
rewrite. The ideal is a fully 3D mode, kept as an option: fully 2D or fully 3D.

[Endless Sky](https://github.com/endless-sky/endless-sky) is the reference implementation
and the source of all content we carry over: its code is GPL-3.0, and its artwork and sounds
are public domain or under permissive Creative Commons licenses.

## Repo layout

- `endless-sky/` — the EndlessSky source tree, as a git submodule (pinned to the latest stable release). Do not edit it in place; our changes live in this repo. See [docs/DESIGN.md](docs/DESIGN.md).
- `docs/` — the design document, the scaffold (implementation list) and project notes.

## Status

Milestone 1 is underway: the loading/boot flow, the main menu, the scenario picker, the
start conversation (scene, text, name prompt), the landing splash, the planet menu (the
landing at the start planet — landscape image, description with live conditions, the
Shipyard button, Depart back to the menu) and the shipyard (buy a ship from the "Basic
Ships" stock) all work, as does the first quest (the "Intro [0]" mission: on-offer
conversation, accept → quest-accepted splash, or decline — both return to the planet menu).
World, flight and takeoff are out of scope until the milestone lands — see
[docs/SCAFFOLD.md](docs/SCAFFOLD.md). Verified with the Vitest unit suite (`npx vitest run`)
and the Playwright e2e suite (`npx playwright test`); the reference's own unit tests are
ported to TypeScript.

## Commands

- `npm run dev` — dev server on 0.0.0.0:5173
- `npm run typecheck` — `tsc --noEmit`
- `npx vitest run` — unit tests (Vitest)
- `npx playwright test` — e2e suite (Playwright, port 5174)
- `npm run build` — production build
