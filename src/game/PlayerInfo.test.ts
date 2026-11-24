import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { StartConditions } from './StartConditions.ts';
import { PlayerInfo } from './PlayerInfo.ts';
import { PilotProfile, DEFAULT_GAMERULES } from './PilotProfile.ts';
import { BookEntry } from './GameAction.ts';
import { parseShip, type Ship } from './Ship.ts';
import { parseMission } from './Mission.ts';

// Tests mirror the reference's PlayerInfo::New semantics for the start flow:
// creating a pilot from a scenario applies the scenario's conditions, and
// naming the pilot updates the pilot profile.

function loadDefaultScenario() {
  const root = parseData(readFileSync('endless-sky/data/starts.txt', 'utf8'));
  const node = root.children.find(n => n.tokens[0] === 'start' && n.tokens[1] === 'default');
  if (!node) throw new Error('default scenario not found');
  const conditions = new ConditionsStore();
  const start = StartConditions.load(node, new ConditionsStore(), conditions);
  start.setState();
  return start;
}


function findShipNode(name: string) {
  const root = parseData(readFileSync('endless-sky/data/human/ships.txt', 'utf8'));
  const node = root.children.find(n => n.tokenOr(0) === 'ship' && n.tokenOr(1) === name);
  if (!node) throw new Error(`ship "${name}" not found`);
  return node;
}

function findIntroMissionNode() {
  const root = parseData(readFileSync('endless-sky/data/human/intro missions.txt', 'utf8'));
  const node = root.children.find(n => n.tokenOr(0) === 'mission' && n.tokenOr(1) === 'Intro [0]');
  if (!node) throw new Error('mission "Intro [0]" not found');
  return node;
}

describe('PlayerInfo', () => {
  it('starts empty (no pilot)', () => {
    const player = new PlayerInfo();
    expect(player.isLoaded()).toBe(false);
    expect(player.getSystem()).toBe('');
    expect(player.getPlanet()).toBe('');
    expect(player.getDate()).toBeNull();
  });

  it('creates a pilot from a start scenario', () => {
    const start = loadDefaultScenario();
    const pilot = new PilotProfile(DEFAULT_GAMERULES);
    pilot.new(DEFAULT_GAMERULES);
    const player = new PlayerInfo();
    player.new(start, pilot);

    expect(player.isLoaded()).toBe(true);
    expect(player.getSystem()).toBe('Rutilicus');
    expect(player.getPlanet()).toBe('New Boston');
    expect(player.getDate()?.toString()).toBe('Tue, 16 Nov 3013');
    expect(player.getAccounts().credits).toBe(480000);
    expect(player.getAccounts().creditScore).toBe(400);
  });

  it('applies the scenario condition assignments', () => {
    const start = loadDefaultScenario();
    const pilot = new PilotProfile();
    const player = new PlayerInfo();
    player.new(start, pilot);

    expect(player.conditions.has('license: Pilot\'s')).toBe(true);
    expect(player.conditions.has('species: human')).toBe(true);
    expect(player.conditions.has('human space start')).toBe(true);
    expect(player.conditions.has('start: default')).toBe(true);
    expect(player.conditions.has('start: vanilla')).toBe(true);
  });

  it('clears any previous player when creating a new one', () => {
    const start = loadDefaultScenario();
    const first = new PilotProfile();
    const player = new PlayerInfo();
    player.new(start, first);
    player.addLogEntry(new BookEntry());
    expect(player.logbook.length).toBe(1);

    player.new(start, new PilotProfile());
    expect(player.logbook.length).toBe(0);
  });

  it('sets the pilot name and propagates it to the pilot profile', () => {
    const start = loadDefaultScenario();
    const pilot = new PilotProfile();
    const player = new PlayerInfo();
    player.new(start, pilot);
    player.setName('Elena', 'Voss');

    expect(player.firstName).toBe('Elena');
    expect(player.lastName).toBe('Voss');
    expect(player.pilot!.fullName()).toBe('Elena Voss');
  });

  it('keeps a copy of the scenario (startData)', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());
    expect(player.startData).toBe(start);
  });

  it('buys a ship: pays for it and adds it to the fleet', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());

    const shuttle = parseShip(findShipNode('Shuttle'));
    expect(player.canAffordShip(shuttle)).toBe(true);
    expect(player.buyShip(shuttle, 'Watchful')).toBe(true);
    expect(player.ships).toHaveLength(1);
    expect(player.ships[0].givenName).toBe('Watchful');
    expect(player.account.credits).toBe(480000 - 180000);
    expect(player.flagship()?.givenName).toBe('Watchful');
  });

  it('refuses to buy a ship the player cannot afford', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());

    const shuttle = parseShip(findShipNode('Shuttle'));
    player.account.credits = 100; // too little

    expect(player.canAffordShip(shuttle)).toBe(false);
    expect(player.buyShip(shuttle, 'Watchful')).toBe(false);
    expect(player.ships).toHaveLength(0);
    expect(player.account.credits).toBe(100); // unchanged
  });

  it('exposes fleet-derived conditions to missions', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());

    const shuttle = parseShip(findShipNode('Shuttle'));
    const sparrow = parseShip(findShipNode('Sparrow'));
    player.buyShip(shuttle, 'Watchful');
    player.buyShip(sparrow, 'Fast');

    expect(player.conditions.get('total ships')).toBe(2);
    expect(player.conditions.get('ships: Transport')).toBe(1);
    expect(player.conditions.get('ships: Interceptor')).toBe(1);
    expect(player.conditions.get('ships: Fighter')).toBe(0);
    expect(player.conditions.get('ship model: Shuttle')).toBe(1);
  });

  it('accepts the intro mission: conditions, logs and tracking', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());

    const shuttle = parseShip(findShipNode('Shuttle'));
    player.buyShip(shuttle, 'Watchful');

    const mission = parseMission(findIntroMissionNode(), player.conditions);
    expect(mission.isOfferable()).toBe(true);

    player.acceptMission(mission);

    expect(player.conditions.get('Intro [0]: offered')).toBe(1);
    expect(player.conditions.get('Intro [0]: active')).toBe(1);
    expect(player.acceptedMissions.some(m => m.name === 'Intro [0]')).toBe(true);
    expect(player.logbook.length).toBe(1);
    expect(player.logbook[0].paragraphs[0]).toContain('James');
    expect(player.specialLogs.get('Minor People')?.get('James')?.paragraphs[0]).toContain('old man');
  });

  it('declines the intro mission: conditions only', () => {
    const start = loadDefaultScenario();
    const player = new PlayerInfo();
    player.new(start, new PilotProfile());

    const mission = parseMission(findIntroMissionNode(), player.conditions);
    player.declineMission(mission);

    expect(player.conditions.get('Intro [0]: offered')).toBe(1);
    expect(player.conditions.get('Intro [0]: declined')).toBe(1);
    expect(player.conditions.has('Intro [0]: active')).toBe(false);
  });

  it('stores special log entries by category and heading', () => {
    const player = new PlayerInfo();
    const entry = new BookEntry();
    entry.paragraphs.push('Republic: democracies.');
    player.addSpecialLog('Factions', 'Republic', entry);

    expect(player.specialLogs.get('Factions')?.get('Republic')).toBe(entry);
  });
});
