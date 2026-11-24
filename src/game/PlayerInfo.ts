// The player — the pilot, their start data, finances, conditions, logbook
// and fleet.
//
// Faithful-enough subset of the reference's PlayerInfo (endless-sky/source/
// PlayerInfo.h/.cpp): the start flow (New()), the logbook + conditions that
// the dialogue and missions write to, and the fleet (ships) the shipyard buys
// and the mission conditions read. Cargo, escorts and event machinery remain
// Milestone 2+.

import { ConditionsStore } from './ConditionsStore.ts';
import type { StartConditions } from './StartConditions.ts';
import type { PilotProfile } from './PilotProfile.ts';
import type { BookEntry } from './GameAction.ts';
import { Account } from './Account.ts';
import type { Date } from '../util/Date.ts';
import type { Ship } from './Ship.ts';
import type { Mission } from './Mission.ts';

export interface OwnedShip {
  // The ship's model (from ships.txt).
  model: Ship;
  // The given name the player chose (or the model name when the name was left blank).
  givenName: string;
}

export class PlayerInfo {
  pilot: PilotProfile | null = null;
  firstName = '';
  lastName = '';
  date: Date | null = null;
  systemName = '';
  planetName = '';
  account: Account = new Account();
  conditions = new ConditionsStore();
  logbook: BookEntry[] = [];
  specialLogs = new Map<string, Map<string, BookEntry>>();
  startData: StartConditions | null = null;
  ships: OwnedShip[] = [];
  acceptedMissions: Mission[] = [];

  // Create a new player from a start scenario and a pilot.
  new(start: StartConditions, pilot: PilotProfile): void {
    // Clear any previous player.
    this.clear();
    this.pilot = pilot;

    this.startData = start;
    this.date = start.core.getDate();
    this.systemName = start.core.getSystem();
    this.planetName = start.core.getPlanet();
    this.account = start.core.getAccounts();

    // Apply the scenario's condition assignments ("set license: Pilot's", ...).
    start.conditions.apply(this.conditions);
    this.pilot.isLoaded = true;

    // Derived conditions that missions read ("total ships", "ships: <category>",
    // "ship model: <model>") — resolved from the live fleet, like the reference.
    this.conditions.provideNamed('total ships', () => this.ships.length);
    this.conditions.providePrefixed('ships: ', (category) =>
      this.ships.filter(s => s.model.category === category).length);
    this.conditions.providePrefixed('ship model: ', (model) =>
      this.ships.filter(s => s.model.name === model).length);
  }

  clear(): void {
    this.pilot = null;
    this.firstName = '';
    this.lastName = '';
    this.date = null;
    this.systemName = '';
    this.planetName = '';
    this.account = new Account();
    this.conditions = new ConditionsStore();
    this.logbook = [];
    this.specialLogs = new Map();
    this.startData = null;
    this.ships = [];
    this.acceptedMissions = [];
  }

  isLoaded(): boolean {
    return this.pilot !== null;
  }

  // --- logbook ------------------------------------------------------------

  addLogEntry(entry: BookEntry): void {
    this.logbook.push(entry);
  }

  addSpecialLog(category: string, heading: string, entry: BookEntry): void {
    if (!this.specialLogs.has(category)) this.specialLogs.set(category, new Map());
    this.specialLogs.get(category)!.set(heading, entry);
  }

  // --- fleet ──────────────────────────────────────────────────────────────

  // Whether the given model can be afforded with the current credits.
  canAffordShip(model: Ship): boolean {
    return this.account.credits >= model.cost;
  }

  // Buy a ship: deduct its cost and add it to the fleet. Returns false (and
  // changes nothing) when the player cannot pay.
  buyShip(model: Ship, givenName: string): boolean {
    if (!this.canAffordShip(model)) return false;
    this.account.credits -= model.cost;
    this.ships.push({ model, givenName });
    return true;
  }

  flagship(): OwnedShip | null {
    return this.ships[0] ?? null;
  }

  // --- missions ────────────────────────────────────────────────────────────

  // Accept a mission: apply the on-accept conditions (": offered" +1, ": active"
  // +1) and the on-accept action's logs. Mirrors the reference's Mission::Do
  // (ACCEPT) + MissionCallback(ACCEPT). The mission is tracked as accepted.
  acceptMission(mission: Mission): void {
    this.conditions.add(`${mission.name}: offered`, 1);
    this.conditions.add(`${mission.name}: active`, 1);
    mission.onAccept.apply(
      (entry) => this.addLogEntry(entry),
      (cat, heading, entry) => this.addSpecialLog(cat, heading, entry),
      this.conditions,
    );
    if (!this.acceptedMissions.some(m => m.name === mission.name)) {
      this.acceptedMissions.push(mission);
    }
  }

  // Decline a mission: apply the on-decline conditions (": offered" +1,
  // ": declined" +1). Mirrors the reference's Mission::Do(DECLINE).
  declineMission(mission: Mission): void {
    this.conditions.add(`${mission.name}: offered`, 1);
    this.conditions.add(`${mission.name}: declined`, 1);
  }

  // --- accessors ----------------------------------------------------------

  getSystem(): string {
    return this.systemName;
  }

  getPlanet(): string {
    return this.planetName;
  }

  getDate(): Date | null {
    return this.date;
  }

  getAccounts(): Account {
    return this.account;
  }

  // Set the pilot's name (called by the conversation).
  setName(first: string, last: string): void {
    this.firstName = first;
    this.lastName = last;
    if (this.pilot) {
      this.pilot.firstName = first;
      this.pilot.lastName = last;
    }
  }

  firstNameValue(): string {
    return this.firstName;
  }

  lastNameValue(): string {
    return this.lastName;
  }
}
