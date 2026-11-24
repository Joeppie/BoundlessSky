import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from '../data/DataParser.ts';
import { ConditionsStore } from './ConditionsStore.ts';
import { parseMission } from './Mission.ts';

// Tests mirror the reference's Intro [0] mission against the real
// intro missions.txt — the source of the first quest of the default start.

function missionNode() {
  const root = parseData(readFileSync('endless-sky/data/human/intro missions.txt', 'utf8'));
  const node = root.children.find(n => n.tokenOr(0) === 'mission' && n.tokenOr(1) === 'Intro [0]');
  if (!node) throw new Error('mission "Intro [0]" not found in intro missions.txt');
  return node;
}

describe('Mission (Intro [0] from intro missions.txt)', () => {
  it('parses identity, placement and conditions', () => {
    const conditions = new ConditionsStore();
    const mission = parseMission(missionNode(), conditions);

    expect(mission.name).toBe('Intro [0]');
    expect(mission.displayName).toBe('Passenger to <planet>');
    expect(mission.description).toContain('destination');
    expect(mission.landing).toBe(true);
    expect(mission.passengers).toBe(1);
    expect(mission.source).toBe('New Boston');
    expect(mission.destination).toBe('New Greenland');
    expect(mission.toOffer.test()).toBe(false); // "start: default" not set yet
    expect(mission.toAccept.test()).toBe(false);  // no ships yet
    expect(mission.onOfferConversation).toBe('intro mission');
    expect(mission.substitutions.get('<trade>')).toBe('stock up on medical goods');
    expect(mission.substitutions.get('<while>')).toContain('big manufacturing worlds');
  });

  it('is offerable once the start is applied and the player owns a ship', () => {
    const conditions = new ConditionsStore();
    conditions.set('start: default', 1);
    // Derived condition: one ship present.
    conditions.provideNamed('total ships', () => 1);
    conditions.providePrefixed('ships: ', () => 0);

    const mission = parseMission(missionNode(), conditions);

    expect(mission.toOffer.test()).toBe(true);
    expect(mission.toAccept.test()).toBe(true);
    expect(mission.isOfferable()).toBe(true);
  });

  it('an interceptor-only fleet makes the mission unofferable', () => {
    const conditions = new ConditionsStore();
    conditions.set('start: default', 1);
    conditions.provideNamed('total ships', () => 1);
    conditions.providePrefixed('ships: ', (category) => (category === 'Fighter' ? 1 : 0));

    const mission = parseMission(missionNode(), conditions);

    // "total ships" > "ships: Fighter" + "ships: Drone" → 1 > 1 → false
    expect(mission.toAccept.test()).toBe(false);
    expect(mission.isOfferable()).toBe(false);
  });

  it('parses the on-accept log entries (plain + special)', () => {
    const conditions = new ConditionsStore();
    const mission = parseMission(missionNode(), conditions);

    expect(mission.onAccept.logEntries.length).toBe(1);
    expect(mission.onAccept.logEntries[0].paragraphs[0]).toContain('James');
    expect(mission.onAccept.specialLogEntries.get('Minor People')?.get('James')).toBeTruthy();
    expect(mission.onAccept.specialLogEntries.get('Minor People')?.get('James')?.paragraphs[0]).toContain('old man');
  });

  it('parses the conversation', () => {
    const root = parseData(readFileSync('endless-sky/data/human/intro missions.txt', 'utf8'));
    const conversationNode = root.children.find(n => n.tokenOr(0) === 'conversation' && n.tokenOr(1) === 'intro mission');
    expect(conversationNode).toBeTruthy();
  });
});
