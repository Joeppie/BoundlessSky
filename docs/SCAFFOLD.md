# BoundlessSky — scaffold: the implementation list

Status: draft for iteration. Parity-first: this is the clean-slate list of everything
BoundlessSky must implement to be the same game as Endless Sky v0.11.4 (see
[DESIGN.md](DESIGN.md)). Nothing here is a new feature. No special or weird stuff —
no 3D, no custom shaders beyond the reference's own special effects, no new artwork or
content, no new gameplay.

## 0. How this document is used

- This is the list of things to implement, not a spec. Steps are ordered by milestone
  (build order), not by importance.
- Only Milestone 1 is committed (owner direction, 2026-11-23): the dialogue/parsing system,
  the ship selection, and getting to the planet menu where the game starts you off.
- Anything not in this document is not in scope. If a "nice to have" appears, it is not
  in scope until it is added here.

## 1. Stack (decided — see DESIGN.md §11)

- **Language:** TypeScript, statically compiled. Not webassembly, not the reference's
  C++ engine.
- **Renderer:** Three.js drawing to a canvas. Shaders for special effects — but
  **initially everything is sprites**; no custom shader code in the first milestones.
- **Later (3D):** 3D models — either a full **3D mode** or a **pseudo-2D** mode: keep the
  classical gameplay loop (2D UI, the map, flight, the planet menu) intact and only
  change how the world is presented. 3D never changes gameplay. See DESIGN.md §5.

## 2. Organization — mirror the C++ layout

The reference (v0.11.4) is a flat `source/` with ~380 modules — mostly one module per
file, grouped by responsibility, plus subfolders (`audio/`, `image/`, `orders/`,
`shader/`, `ship/`, `text/`, `windows/`, `comparators/`, `test/`).

BoundlessSky keeps the same shape, in TypeScript:

- One reference module → one TypeScript module, same name (camelCase file).
- Same responsibilities, same responsibilities per file — not new subsystems.
- Subfolders under `src/` per subsystem, mirroring the reference's subfolders and the
  top-level groups (`data/`, `text/`, `audio/`, `image/`, `shader/`, `orders/`,
  `ship/`, `missions/`, `dialog/`, `world/`, `flight/`, `ai/`, `economy/`, `game/`,
  `ui/`, `save/`, `plugins/`, `util/`, `app/`, `render/`).
- Tests mirror `tests/unit/` + `tests/integration/` (ours, in TypeScript).
- Content (`data/`, `images/`, `sounds/`) stays in the read-only submodule, served as-is
  (see DESIGN.md §7–8).

| Reference module(s) | BoundlessSky | Notes |
|---|---|---|
| `DataFile`, `DataNode`, `DataWriter`, `StringInterner` | `src/data/` | indented-text parser, the parse tree, writers |
| `main`, `GameWindow`, `FrameTimer` | `src/app/` | bootstrap — canvas host, event loop |
| `UI`, `Panel` | `src/ui/` | panel stack, base class |
| `TextArea`, `text/*` (`Format`, `WrappedText`, `Utf8`, `Font`, `FontSet`, `Table`, `Alignment`, `Layout`, `Clipboard`) | `src/text/`, `src/ui/` | text rendering, wrapping, alignment |
| `audio/*` (`Audio`, `Sound`, `Music`) | `src/audio/` | wav playback |
| `image/*` (`Sprite`, `SpriteSet`, `ImageSet`, `Mask`, `MaskManager`, `SpriteLoadManager`, `ImageBuffer`) | `src/image/` | sprites and textures |
| `shader/*` (`SpriteShader`, `BatchShader`, `DrawList`, …) | `src/render/` | drawn as sprites initially; shader use deferred |
| `orders/*` (`Orders`, `OrderSet`, `OrderSingle`) | `src/orders/` | ship orders |
| `Ship`, `ShipFactory`, `ShipEvent`, `ShipManager`, `ShipJumpNavigation`, `Hardpoint`, `Armament`, `Weapon`, `Outfit`, `CargoHold`, `ResourceLevels`, `Fleet`, `FleetCargo`, `FormationPattern`, `FormationPositioner`, `Flotsam` | `src/ship/` | the ship domain |
| `Engine`, `Camera`, `Screen`, `Drawable`, `Visual`, `Effect`, `Endpoint`, `RenderBuffer` | `src/flight/` + `src/render/` | game simulation + camera |
| `AsteroidField`, `Weather`, `Planet`, `System`, `Body`, `StellarObject`, `Wormhole`, `Galaxy`, `StarField` | `src/world/` | the world model |
| `RouteEdge`, `RoutePlan`, `DistanceMap`, `DistanceCalculationSettings` | `src/world/` | route planning |
| `Projectile`, `Collision`, `CollisionSet`, `Confusion`, `Minable`, `Hazard`, `Radar`, `EscortDisplay` | `src/flight/` + `src/ai/` | combat and hazards |
| `AI`, `ShipAICache`, `NPC`, `NPCAction`, `Flotsam` | `src/ai/` | AI |
| `Mission`, `MissionAction`, `MissionTimer`, `ConditionsStore`, `ConditionSet`, `ConditionEntry`, `ConditionAssignments`, `GameAction`, `GameEvent`, `CustomEvents`, `CaptureOdds` | `src/missions/` + `src/game/` | missions |
| `Conversation`, `ConversationPanel`, `DialogPanel`, `DialogSettings`, `Dictionary`, `Paragraphs`, `Phrase`, `Personality`, `TextReplacements` | `src/dialog/` | dialogue |
| `CoreStartData`, `StartConditions`, `StartConditionsPanel`, `PilotProfile`, `PlayerInfo` | `src/game/` | start flow and pilot |
| `Account`, `Mortgage`, `Depreciation`, `Information`, `Statistics`, `News`, `BookEntry`, `Person` | `src/economy/` | economy |
| `GameData`, `UniverseObjects`, `Gamerules`, `Preferences`, `PreferencesPanel`, `StartConditions` | `src/game/` | global registry and start |
| `SavedGame`, `Files`, `ZipFile`, `PrintData` | `src/save/` | save/load |
| `Plugin`, `PluginManager` | `src/plugins/` | plugins (last, parity late) |
| `MainPanel`, `MapPanel`, `MapDetailPanel`, `PlanetPanel`, `MenuPanel`, `MenuAnimationPanel`, `MapPlanetCard`, `MapShipyardPanel`, `MapSalesPanel`, `MapOutfitterPanel`, `ShipyardPanel`, `ShopPanel`, `TradingPanel`, `BankPanel`, `SpaceportPanel`, `HiringPanel`, `OutfitterPanel`, `MissionPanel`, `HailPanel`, `LogbookPanel`, `PlayerInfoPanel`, `GamerulesPanel`, `OptionalInputDialogPanel`, `ShipNameDialogPanel`, `Tooltip`, `Dropdown`, `CategoryList`, `TableArea`, `ScrollArea`, `ScrollBar`, `MiniMap`, `InfoPanelState`, `LoadingCircle`, `GameLoadingPanel`, `LoadPanel`, `MessageLogPanel`, `Message`, `Messages`, `AlertLabel`, `AmmoDisplay`, `Button` | `src/ui/` | the UI shell |
| `Angle`, `Point`, `Rectangle`, `Color`, `Bitset`, `Random`, `Variant`, `EsUuid`, `Date`, `Statistics`, `GameVersion`, `Logger`, `Preferences` | `src/util/` | utilities |

## 3. Milestone 1 — the start (the committed first step)

**Goal:** the game boots → main menu → select a starting scenario → name/log/start
conversation → ship selection (buy the first ship or pick one from the scenario) → the
player lands and the **planet menu opens**. The start of the real game.

In the reference (v0.11.4) this is: `MenuPanel` → `StartConditionsPanel` →
`PlayerInfo.New(scenario)` → `ConversationPanel` (the start conversation) →
`MainPanel` → auto-popped `PlanetPanel` (the player is at the start planet) → and, when
the scenario specifies no ships (the default start), a `ShipyardPanel` on top, which is
where the player buys/selects the first ship.

| Step | What to implement | Where | Verified by |
|---|---|---|---|
| 1 | Data parser: the indented text format (`#`-comments, backtick strings, indent-based children, key value `add`/`remove`) | `src/data/` | loading `data/starts.txt`, `data/_ui/interfaces.txt`, and the default start's conversation; dumping the parse tree and diffing against the reference |
| 2 | Text and layout: wrapped text, fonts, alignment, colors, raster text drawing on a sprite/canvas | `src/text/` | rendering a `Conversation`'s text lines, byte-comparable to the reference's text output |
| 3 | Dialogue system: `Conversation` (parse nodes: text/scene/choice/action/name/branch, condition evaluation), the scene sprite, `GameAction` log entries (the "log" action at the start of a conversation) | `src/dialog/` | parsing the `default intro` conversation from `data/starts.txt` and reproducing its node/scene/log structure |
| 4 | `ConversationPanel`: the node flow, choice buttons, name prompt, scene display, log lines | `src/dialog/` | the default start conversation plays to completion (name prompt → "There are three ship models…") |
| 5 | Start flow: `StartConditions` (load scenarios), `StartConditionsPanel` (list, descriptions, click/enter), `PilotProfile`, `PlayerInfo.New` | `src/game/`, `src/ui/` | the default start scenario is selectable and starts the player |
| 6 | Ship selection: the start scenario's ships, or `ShipyardPanel` (list ships in the scenario's/planet's stock, buy one) | `src/game/`, `src/ui/`, `src/ship/` | the default start opens the shipyard (no ships) and a ship can be bought |
| 6b | The first quest: the "Intro [0]" mission — the on-offer conversation, offer/accept conditions (`has "start: default"`, `"total ships" > "ships: Fighter" + "ships: Drone"`), accept → on-accept logs + `"Intro [0]: active"` condition, decline → `"Intro [0]: declined"`, and the quest-accepted splash | `src/game/`, `src/data/`, `src/ui/` | the default start, after buying the first ship, offers the quest; accept → quest-accepted splash, decline → menu |
| 7 | Flight shell: `MainPanel` (a working game view — a starfield + camera + sprite drawing skeleton), the landing check, the auto-open of `PlanetPanel` | `src/game/`, `src/flight/`, `src/world/`, `src/ui/` | the player is at the start planet; the planet panel opens automatically |
| 8 | Planet menu: `PlanetPanel` (description, landscape image, close back to the map) | `src/ui/`, `src/game/`, `src/data/` | the planet menu opens on the start planet (New Boston for the default start) with its landscape, its description (conditions evaluated against the live player) and the Shipyard button |

Verification: parsing, dialogue, the shipyard, the first quest and the landing→planet-menu
tail work end-to-end with the reference as baseline — the default start conversation plays,
the landing splash opens the planet menu (landscape, description, Shipyard button — Depart
back to the menu), the player buys a ship from the "Basic Ships" stock, the intro mission is
offered (accept → quest-accepted splash; decline) and the player returns to the planet menu.
Not yet: a real map/MainPanel (the landing splash stands in for it), outfits, takeoff.

## 4. Milestones 2–4 — the rest (the parity list)

**Milestone 2 — world and flight (the game view)**

- World model: `System`, `Planet`, `Body`, `StellarObject`, `Wormhole`, `Galaxy`, `StarField` background, `AsteroidField` (asteroids, rotated by us with sprite transforms — see DESIGN.md §8), `Weather`.
- Path planning: `RoutePlan`, `RouteEdge`, `DistanceMap`.
- Flight view: camera (follow the flagship), the star map panel, the orbit map, the side panel list of ships, the missile/radar display, the minimap.
- Verified by: landing at a planet, charting a route, flying between systems.

**Milestone 3 — ships and combat**

- `Ship` model: structure, resources, engines, hardpoints, arms, cargo, outfits (`Outfit`, `Weapon`, `Armament`, `ResourceLevels`, `CargoHold`, `ShipFactory`, `ShipManager`, `Fleet`, `FleetCargo`, `ShipEvent`).
- Combat: `Projectile`, `Collision`, `CollisionSet`, `Confusion`, `Radar`, `Hazard`, `Weather` effects, `Minable`, escort logic (`EscortDisplay`, `FormationPattern`, `FormationPositioner`), `AI`/`ShipAICache`/`NPC`/`NPCAction`/`Flotsam`.
- Verified by: fighting, escorting, mining, outfits working.

**Milestone 4 — missions, economy, panels, save/load**

- Conditions + missions: `ConditionsStore`, `ConditionSet`, `ConditionEntry`, `ConditionAssignments`, `Mission`, `MissionAction`, `MissionTimer`, `GameAction`, `GameEvent`, `CustomEvents`, `CaptureOdds`, `NpcAction`.
- Economy: `Account`, `Mortgage`, `Depreciation`, `Information`, `Statistics`, `News`, `BookEntry`, `Person`, `PilotProfile` (licenses, points, species).
- UI shell: all panels (map, menu, shipyard, trading, bank, spaceport, hiring, outfitter, mission, hail, logbook, player info, gamerules, preferences, tooltip, dropdown, category list, table area, scroll areas, loading/load panels, message log, Flotsam/Escort).
- Save/load: `SavedGame`, `Files`, `ZipFile`, `PrintData`, autosave, continue/load.
- Verified by: playing the full game, mission/dialogue/quest parity, save/load, all menus.

**Plugins and late items** (parity-late; the reference ships plugins — we mirror the
`plugin` mechanism, not plugin \*content\*) continue in this milestone or its own late
milestone; they are not part of Milestone 1.

## 5. Milestone 5 — 3D (later)

After parity, recorded as part of the direction (DESIGN.md §2/§5): a pseudo-2D or full 3D
mode. 3D models for ships/asteroids/effects (sprites → 3D), shaders for special effects,
the optional full-3D mode. Classical gameplay loop stays intact.

## 6. Explicitly out of scope (for now)

- **Everything 3D.** No 3D models, no full 3D mode, no shaders beyond the reference's
  (in its early stages: nothing). Everything initial is sprites.
- **New artwork or models.** All images/sounds come from the submodule, as-is. No new
  artwork, no new shaders, no new UI art.
- **New gameplay or content.** No new missions, dialogue lines, ships, systems, or any
  change to the world or balance.
- **Plugins/editor tooling.** Mirror the plugin mechanism only, and only when Milestone 4
  is nearly done.

## 7. Verification approach

- Parity against the reference (v0.11.4): build the reference, compare behavior. The
  reference's own `tests/` is the comparison baseline (unit + integration).
- Milestone 1 is verified end-to-end with the default start scenario: the game boots, the
  start screen lists the scenarios, the default start plays its conversation, the player
  buys a ship (the "Basic Ships" stock), the intro mission is offered, and the player
  accepts (quest-accepted splash) or declines (menu). The corner HUD, Player Info, the
  Outfitter and the flight view are committed on top of this (see docs/LIMITS.md).
- e2e (Playwright, `npx playwright test`) drives the accept and decline paths in a real
  browser, including the planet-menu hop; the Vitest unit suite (`npx vitest run`, 183
  tests) covers the parsers and state machines.
