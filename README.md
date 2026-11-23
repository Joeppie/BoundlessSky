# BoundlessSky

A faithful reproduction of the Endless Sky game: same logic, dialogue, quests and
systems, rebuilt in our own codebase.

The project starts as a faithful 2D reproduction of the entire game — complete parity:
everything the reference game does, BoundlessSky does. A 3D presentation is added later
as an optional mode/module/mod layered on the 2D core — never load-bearing, never a
rewrite. The ideal is a fully 3D mode, kept as an option: fully 2D or fully 3D.

[Endless Sky](https://github.com/endless-sky/endless-sky) is the reference implementation
and the source of all content we port: its code is GPL-3.0, and its artwork and sounds
are public domain or under permissive Creative Commons licenses.

## Repo layout

- `endless-sky/` — the EndlessSky source tree, as a git submodule (pinned to the latest stable release). Do not edit it in place; our changes live in this repo. See [docs/DESIGN.md](docs/DESIGN.md).
- `docs/` — the design document and project notes.

## Status

Early design stage. Nothing is built yet; see [docs/DESIGN.md](docs/DESIGN.md) for the
scope, the submodule workflow and the open questions before any code is written.
