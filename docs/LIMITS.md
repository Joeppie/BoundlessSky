# Limits — what this milestone does not model

Everything in this file is a known, deliberate shortfall of the current milestone. The
rule: a limit is either **hidden, not faked** (a panel/button that doesn't exist) or
**labeled** (a screen says so on screen). Nothing in the UI pretends to do something
the code does not. Code comments at each site carry the same note — this doc is the
index of them.

## The flight view (Milestone 2 — in progress)

The flight view is a **simplified in-system model**, not the reference's full map.
The reference has no continuous in-system flight mode — its ships hop system to
system on its map. This milestone adds the simplified model on top of the same real
data (map systems.txt / map planets.txt / the ship and its installed outfits).

- **Flight runs at 0.25× time.** The reference's ship speeds (~800 u/s) cross the
  drawn system in under a second, which is unwatchable. Physics are unchanged — only
  the view rate. Documented at the loop in `src/ui/FlightScreen.ts`.
- **Momentum remains** — releasing thrust does not stop the ship; it coasts through
  linear drag. Kinetic formula set in `src/game/FlightSim.ts`:
  - `maxSpeed = 60 × thrust / drag`
  - `thrustAccel = 3600 × thrust / fullMass`
  - `dragAccel = thrustAccel × speed / maxSpeed`
  - `brakeAccel = 0.5 × thrustAccel` (simplified reverse thrust — the reference has a
    proper reverse engine; this is a deliberate, documented simplification)
  - `turnRate = 60 × turn / fullMass`
- **No cloaking** — the reference has cloaking (cloak speed / disruption); we do not.
- **No jump range / fuel cost / heat cost** — the warp picker lists real jump-neighbor
  systems and says so on screen ("jump-range and fuel costs are not modeled").
- **No wormholes** — the reference's wormholes/anomalies are not modeled.
- **No full map model** — the flight view draws the system at the planet's orbit as
  SVG circles (star, orbit rings, planet glyphs, the ship). The reference's full map
  (map beyond patir, the global map, distance map, routes) is not modeled.
- **No 3D glyph** — planes are drawn as circles, not the reference's 3D planet models.
- **Landing requires being over the planet and slow** — the landing zone is tied to
  the rendered glyph (3× the glyph radius) and the ship must be under 10% of max
  speed. The reference's landing mechanics are not reproduced.
- **Warp requires a near-stop** (under 5% of max speed) and a hyperdrive. The ship
  has none by default (the milestone ship has only the standard ion thruster) —
  warp is disabled for a ship without a hyperdrive, and the button says so.
- **Warp destinations are the system's real jump-neighbor systems** with a named,
  loadable planet. Systems with no named planet (e.g. Holeb) are shown as disabled
  rows. Jump ranges and fuel costs are not modeled.

## The corner HUD

- **Rings report 100%/mint-ship integrity** — no damage or resource model exists
  yet, so the shield/hull rings are decorative 100%. They are not live readouts.
- **No fuel/energy/heat bars** — resources are not modeled (Milestone 3+); the bars
  are omitted rather than faked as full.

## Player Info / Ship Info

- **Untracked stats are footnoted, never invented** — cargo is not tracked, combat/
  fleet ratings do not exist. The Ship Info tab shows the reference's stat table
  (model, cost, shields, hull, mass, movement, free capacities, energy/heat) computed
  from the real ship and its installed outfits (`src/game/ShipInfo.ts`). Numbers match
  the reference's Star Barge display to ~2nd decimal.
- **No outfit installation** — outfits are resolved against the real outfit catalog
  and shown grouped by category, but there is no Buy/Install button (not modeled yet).
- **No damage, no resources** — same as the corner HUD.

## The Outfitter

- **Browsing only** — the outfitter lists the planet's own stock (the shops the planet
  names) with thumbnails and details. **No install button** — installing outfits is
  not modeled (Milestone 3), so there is no working install path and no fake button.
- **Stock is read live from map planets.txt** — the shops a planet carries are the
  planet's own `outfitters`; never a hardcoded list.

## The Planet menu / Shops

- **Shops serve the planet's own stock** — the shipyard and outfitter show the
  shops the landing planet names (never a hardcoded New Boston list).
- **Unimplemented panels are hidden** — Spaceport, Bank, Trading, Job Board, Hire
  Crew, Rename, Logbook, Missions, and the rest of the reference's planet panel
  are not implemented and are omitted rather than faked.

## The ship (milestone model)

- **Single flagship** — the player has one flagship; no fleet beyond it, no cargo
  hold, no damage model.
- **Outfits are resolved but not installed** — an outfit appears in the ship's
  outfits column because the milestone ship comes with a fixed set; the install
  mechanics (slot, mass, outfit-space checks) are not modeled.
- **No cargo, no ammo, no weapons** in the milestone ship — the physics model uses
  only thrust, drag, turn, and mass.

## The start flow

- **Start flow is Milestone 1 only** — the new-pilot start (the default scenario →
  conversation → landing splash → planet menu → shipyard → first quest) is the
  only flow. No scenario loading beyond the default; no other start conditions.
- **A single mission (Intro [0]) is offered** — the intro mission accept/decline
  path is the only mission; no other missions, no mission history.

## Corner HUD / menu / screens not implemented

- **No menu-level tabs** beyond the ones wired in the Milestone 1 tail.
- **No save/load** — the game does not persist anything across reloads.
- **No minimap / global map / routes** — no global map; no route planning.
- **No sound engine for the reference's full sound set** — the milestone uses the
  small ambient set (a few UI sounds), not the reference's full audio.

## Not a bug — deliberate view choices

- **Flight view time scale (0.25×)** — see above.
- **The warp picker jumps to any named planet in the destination system** — the
  picker offers one row per named planet of the destination system (the milestone's
  jump model does not pick a specific orbital position, so any named planet can be
  the destination).

## Where the code keeps the same notes

The same honesty rules are in the code, next to the code:

- `src/ui/CornerHud.ts` — rings honest 100%; no fuel/energy/heat bars.
- `src/ui/FlightScreen.ts` — 0.25× time, simplified flight model, warp gates.
- `src/game/FlightSim.ts` — the physics formulas and the brake simplification.
- `src/ui/OutfitterScreen.ts` — browsing only; no install button.
- `src/ui/PlayerInfoScreen.ts` — untracked stats footnoted; no install button.
- `src/ui/PlanetMenuScreen.ts` — unimplemented panels hidden.
- `src/ui/CornerHud.ts`, `src/ui/FlightScreen.ts` — jump-range/fuel costs not modeled.
