// The composition root — wires loading, screens and the game state machine
// together.
//
// The milestone flow:
//   loading → menu → NEW PILOT → scenario picker → intro conversation
//     → landing splash → planet menu (landing) → shipyard (buy a ship)
//       → intro mission (quest accept) → splash (quest accepted) → planet menu
//         → Depart → menu

import { Background } from '../render/Background';
import { Audio } from '../audio/Audio';
import { LoadingScreen } from '../ui/LoadingScreen';
import { MenuScreen } from '../ui/MenuScreen';
import { StartConditionsScreen } from '../ui/StartConditionsScreen';
import { ConversationScreen } from '../ui/ConversationScreen';
import { ArrivalScreen } from '../ui/ArrivalScreen';
import { ShipyardScreen } from '../ui/ShipyardScreen';
import { PlanetMenuScreen } from '../ui/PlanetMenuScreen';
import { FlightScreen, type LandableTarget, type WarpRow } from '../ui/FlightScreen';
import { CornerHud } from '../ui/CornerHud';
import { PlayerInfoScreen } from '../ui/PlayerInfoScreen';
import { OutfitterScreen } from '../ui/OutfitterScreen';
import { loadGameData, type LoadedGameData } from '../data/GameData';
import { loadShipyards } from '../data/ShipyardData';
import { loadPlanet } from '../data/PlanetData';
import { loadSystem } from '../data/SystemData';
import { computeShipInfo, resolveInstalledOutfits } from '../game/ShipInfo';
import { makeShipPhysics } from '../game/FlightSim';
import type { Planet } from '../game/Planet';
import { loadOutfitterStock, loadOutfitCatalog } from '../data/OutfitterData';
import { loadIntroMission } from '../data/MissionData';
import { PlayerInfo } from '../game/PlayerInfo';
import { PilotProfile, DEFAULT_GAMERULES } from '../game/PilotProfile';
import type { StartConditions } from '../game/StartConditions';
import type { Mission } from '../game/Mission';
import type { Ship } from '../game/Ship';
import { playEnter, playExit } from '../ui/Panel';
import { replace } from '../util/Format';

interface Screen {
  element: HTMLElement;
  mount: () => void;
  unmount: () => void;
  handleKey: (event: KeyboardEvent) => boolean;
}

export class Game {
  private app: HTMLElement;
  private background: Background | null = null;
  private audio: Audio;
  private screen: Screen | null = null;
  private data: LoadedGameData | null = null;
  private player = new PlayerInfo();
  private starting = false;
  private cornerHud: CornerHud;

  constructor(appElement: HTMLElement) {
    this.app = appElement;
    this.audio = new Audio();
    this.cornerHud = new CornerHud();
  }

  // --- lifecycle ───────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.background = new Background();
    const backdrop = document.getElementById('backdrop');
    if (backdrop) {
      this.background.start(backdrop);
    }
    document.body.appendChild(this.cornerHud.element);
    this.refreshHud();

    const audio = this.audio;
    const loading = new LoadingScreen(audio, () => {
      this.showScreen(this.menuScreen());
    });
    this.showScreen(loading);
  }

  private startNewPilot(): void {
    if (this.starting) return;
    this.starting = true;
    this.ensureData().then(data => {
      this.showScreen(new StartConditionsScreen(
        this.audio,
        data,
        (start) => this.startConversation(start),
        () => {
          this.starting = false;
          this.showScreen(this.menuScreen());
        },
      ));
    });
  }

  private ensureData(): Promise<LoadedGameData> {
    if (this.data) return Promise.resolve(this.data);
    return loadGameData(() => {}).then(data => {
      this.data = data;
      return data;
    });
  }

  private startConversation(start: StartConditions): void {
    const pilot = new PilotProfile(DEFAULT_GAMERULES);
    pilot.new(DEFAULT_GAMERULES);
    this.player.new(start, pilot);
    const data = this.data!;
    const conversation = start.conversationNode
      ?? data.conversationsByName.get(start.getConversationByName() ?? '');

    this.showScreen(new ConversationScreen(
      this.audio,
      this.player,
      {
        mode: 'start',
        conversationNode: conversation ?? null,
        onDone: () => {
          this.starting = false;
          this.showScreen(new ArrivalScreen(this.audio, this.player, () => this.afterArrival(), {
            hint: 'to the planet',
          }));
        },
      },
    ));
  }

  private continueToArrival(): void {
    if (!this.player.isLoaded()) return;
    this.showScreen(new ArrivalScreen(this.audio, this.player, () => this.afterArrival(), {
      hint: 'to the planet',
    }));
  }

  // After the landing splash: the player is at the start planet — the planet
  // menu opens automatically (the reference auto-pops the PlanetPanel when the
  // player lands). The shipyard opens from it.
  private afterArrival(): void {
    this.showScreen(this.planetMenuScreen());
  }

  private planetMenuScreen(): PlanetMenuScreen {
    return new PlanetMenuScreen({
      audio: this.audio,
      player: this.player,
      loadPlanet: () => loadPlanet(
        this.player.planetName || 'New Boston',
        this.player.conditions,
        (m) => console.warn(m),
      ),
      onShipyard: (planet) => this.showScreen(this.shipyardScreen(planet)),
      onOutfitter: (planet) => this.showScreen(this.outfitterScreen(planet)),
      onPlayerInfo: () => this.showScreen(this.playerInfoScreen()),
      // Depart has no map yet (Milestone 2) — back to the menu for now.
      onDepart: () => this.showScreen(this.flightScreen()),
    });
  }

  // The flight view — Depart browses the system's flight model (the reference
  // has no continuous in-system flight; this milestone adds it on top of the
  // real planet/system data). Starts at the current planet.
  private flightScreen(): FlightScreen {
    return new FlightScreen({
      audio: this.audio,
      player: this.player,
      systemName: this.player.systemName || 'Rutilicus',
      planetName: this.player.planetName || 'New Boston',
      loadFlight: () => this.loadFlightScene(),
      loadDestinations: (system) => this.loadWarpDestinations(system),
      onLand: (spec, system) => {
        this.player.systemName = system.name;
        this.player.planetName = spec.name;
        this.showScreen(this.planetMenuScreen());
      },
      onWarp: (system, planetName) => {
        this.player.systemName = system.name;
        this.player.planetName = planetName;
        this.showScreen(this.flightScreen());
      },
      onAbort: () => this.showScreen(this.planetMenuScreen()),
      onMenu: () => this.showScreen(this.menuScreen()),
    });
  }

  private async loadFlightScene(): Promise<{
    system: import('../game/System').System;
    spawnPlanet: LandableTarget;
    landable: LandableTarget[];
    physics: ReturnType<typeof makeShipPhysics>;
    hasHyperdrive: boolean;
  }> {
    const systemName = this.player.systemName || 'Rutilicus';
    const planetName = this.player.planetName || 'New Boston';
    const system = await loadSystem(systemName, (m) => console.warn(m));
    const spawnSystemPlanet = system.planets.find(p => p.name === planetName);
    if (!spawnSystemPlanet) {
      throw new Error(`planet "${planetName}" not found in system "${systemName}"`);
    }
    const spec = await loadPlanet(planetName, this.player.conditions, (m) => console.warn(m));
    const spawnPlanet: LandableTarget = { planet: spawnSystemPlanet, spec };

    // Every named planet in the system is landable (with its spec from the real file).
    const landable: LandableTarget[] = [];
    for (const planet of system.planets) {
      if (!planet.name) continue;
      try {
        const planetSpec = await loadPlanet(planet.name, this.player.conditions, (m) => console.warn(m));
        landable.push({ planet, spec: planetSpec });
      } catch {
        // A named world the real file can't define — not landable here.
      }
    }

    const flagship = this.player.flagship();
    if (!flagship) throw new Error('no flagship to fly');
    const catalog = await loadOutfitCatalog((m) => console.warn(m));
    const installed = resolveInstalledOutfits(flagship.model, catalog, (m) => console.warn(m));
    const info = computeShipInfo(flagship.model, installed);
    const physics = makeShipPhysics(flagship.model, info.thrust, info.turn, info.emptyMass);
    const hasHyperdrive = installed.some(i => (i.outfit.attributes['hyperdrive'] ?? 0) > 0);

    return { system, spawnPlanet, landable, physics, hasHyperdrive };
  }

  // Warp destinations — the system's jump-neighbor systems with landable
  // named planets (with their specs). Systems with no named planet are
  // listed as disabled rows, honestly.
  private async loadWarpDestinations(system: import('../game/System').System): Promise<WarpRow[]> {
    const rows: WarpRow[] = [];
    for (const linkName of system.links) {
      let neighbor: import('../game/System').System;
      try {
        neighbor = await loadSystem(linkName, (m) => console.warn(m));
      } catch {
        continue; // a missing jump neighbor — not offered
      }
      const before = rows.length;
      for (const planet of neighbor.planets) {
        if (!planet.name) continue;
        try {
          const spec = await loadPlanet(planet.name, this.player.conditions, (m) => console.warn(m));
          rows.push({ system: neighbor, planet, spec, disabledReason: null });
        } catch {
          // A named planet the real file can't define — not landable here.
        }
      }
      if (rows.length === before) {
        rows.push({
          system: neighbor,
          planet: null,
          spec: null,
          disabledReason: 'no landable named planet here',
        });
      }
    }
    return rows;
  }

  private outfitterScreen(planet: Planet): OutfitterScreen {
    return new OutfitterScreen({
      audio: this.audio,
      player: this.player,
      planet: planet,
      loadStock: () => loadOutfitterStock(planet.outfitters, (m) => console.warn(m)),
      onBack: () => this.showScreen(this.planetMenuScreen()),
    });
  }

  private playerInfoScreen(): PlayerInfoScreen {
    return new PlayerInfoScreen({
      audio: this.audio,
      player: this.player,
      loadCatalog: () => loadOutfitCatalog((m) => console.warn(m)),
      onDone: () => this.showScreen(this.planetMenuScreen()),
    });
  }

  private shipyardScreen(planet: Planet): ShipyardScreen {
    // The stock loads lazily; the screen renders it when the promise resolves.
    // Every call fetches fresh so the screen's Retry button re-runs a real load.
    return new ShipyardScreen({
      audio: this.audio,
      player: this.player,
      planet: planet,
      loadStock: () => loadShipyards(planet.shipyards, (m) => console.warn(m)),
      onBuy: (model, givenName) => this.afterBuy(model, givenName),
      onLeave: () => this.showScreen(this.planetMenuScreen()),
    });
  }

  // Shared buy handling: the player now owns a ship, so the landing (and thus
  // the intro mission offer) follows, exactly like the reference's flow.
  private afterBuy(model: Ship, givenName: string): void {
    this.startMissionOffer();
  }

  private startMissionOffer(): void {
    const missionPromise = loadIntroMission(this.player.conditions, (m) => console.warn(m));
    missionPromise.then(({ conversationNode, mission }) => {
      if (!mission.isOfferable()) {
        this.showScreen(this.menuScreen());
        return;
      }
      this.showScreen(new ConversationScreen(
        this.audio,
        this.player,
        {
          mode: 'mission',
          mission,
          conversationNode: conversationNode ?? null,
          title: this.missionText(mission, mission.title),
          onDone: (endpoint) => this.finishMission(mission, endpoint),
        },
      ));
    }).catch(err => {
      console.warn('intro mission failed to load', err);
      this.showScreen(this.menuScreen());
    });
  }

  // Substitute a mission's title/description with the same substitutions the
  // mission conversation uses (<planet>, <destination>, <origin>, <trade>,
  // <while>, plus the player's reserved keys).
  private missionText(mission: Mission, text: string): string {
    const subs = new Map<string, string>();
    subs.set('<first>', this.player.firstName);
    subs.set('<last>', this.player.lastName);
    subs.set('<planet>', mission.destination);
    subs.set('<destination>', mission.destination);
    subs.set('<origin>', mission.source);
    for (const [key, value] of mission.substitutions) subs.set(key, value);
    const flag = this.player.flagship();
    if (flag) {
      subs.set('<ship>', flag.givenName);
      subs.set('<model>', flag.model.name);
    }
    return replace(text, subs);
  }

  private finishMission(mission: Mission, endpoint: number): void {
    if (endpoint === -1 || endpoint === -4) {
      // Accept / launch: the reference applies the on-accept conditions + logs.
      this.player.acceptMission(mission);
      this.showScreen(new ArrivalScreen(this.audio, this.player, () => this.showScreen(this.planetMenuScreen()), {
        kicker: 'Quest accepted',
        title: this.missionText(mission, mission.title),
        sub: this.missionText(mission, mission.description),
        hint: 'to the planet',
        meta: [
          ['Mission', this.missionText(mission, mission.title)],
          ['Destination', mission.destination],
          ['Credits', String(this.player.account.credits)],
          ['Status', 'Accepted'],
        ],
      }));
    } else {
      // Decline / defer: the reference applies the decline conditions and
      // returns the player to the planet — the planet menu, here.
      this.player.declineMission(mission);
      this.showScreen(this.planetMenuScreen());
    }
  }

  private menuScreen(): MenuScreen {
    const menu = new MenuScreen(this.audio,
      () => this.startNewPilot(),
      () => this.continueToArrival(),
      () => this.quit(),
    );
    menu.setPlayer(this.player.isLoaded() ? this.player : null);
    return menu;
  }

  private quit(): void {
    // No save/quit machinery for this milestone — the menu reloads the app.
    window.location.reload();
  }

  // --- shared helpers ──────────────────────────────────────────────────────

  private refreshHud(): void {
    this.cornerHud.setPlayer(this.player.isLoaded() ? this.player : null);
  }

  private showScreen(screen: Screen): void {
    const current = this.screen;
    this.screen = screen;
    this.refreshHud();

    // Drop stale screens that were left mid-exit by a previous, even later
    // transition — fast chained screens would otherwise pile up in the DOM.
    for (const el of this.app.querySelectorAll('.screen.is-leaving')) el.remove();

    if (current) {
      current.unmount();
      playExit(current.element, () => {
        current.element.remove();
      });
    }

    this.app.appendChild(screen.element);
    screen.mount();
    playEnter(screen.element);
  }

  // --- global keyboard routing ─────────────────────────────────────────────

  handleGlobalKey(event: KeyboardEvent): void {
    if (this.screen && this.screen.handleKey(event)) return;
  }
}
