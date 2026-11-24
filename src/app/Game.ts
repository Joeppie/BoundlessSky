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
import { loadGameData, type LoadedGameData } from '../data/GameData';
import { loadShipyard } from '../data/ShipyardData';
import { loadPlanet } from '../data/PlanetData';
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

  constructor(appElement: HTMLElement) {
    this.app = appElement;
    this.audio = new Audio();
  }

  // --- lifecycle ───────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.background = new Background();
    const backdrop = document.getElementById('backdrop');
    if (backdrop) {
      this.background.start(backdrop);
    }

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
      onShipyard: () => this.showScreen(this.shipyardScreen()),
      // Depart has no map yet (Milestone 2) — back to the menu for now.
      onDepart: () => this.showScreen(this.menuScreen()),
    });
  }

  private shipyardScreen(): ShipyardScreen {
    // The stock loads lazily; the screen renders it when the promise resolves.
    // Every call fetches fresh so the screen's Retry button re-runs a real load.
    return new ShipyardScreen({
      audio: this.audio,
      player: this.player,
      loadStock: () => loadShipyard('Basic Ships', (m) => console.warn(m)),
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

  private showScreen(screen: Screen): void {
    const current = this.screen;
    this.screen = screen;

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
