import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseData } from './DataParser.ts';
import { parseIntroMission, INTRO_MISSION_NAME } from './MissionData.ts';
import { ConditionsStore } from '../game/ConditionsStore.ts';

// Tests mirror the reference's Intro [0] quest + the "intro mission"
// conversation it offers.

describe('MissionData (from intro missions.txt)', () => {
  const root = parseData(readFileSync('endless-sky/data/human/intro missions.txt', 'utf8'));

  it('returns the parsed mission and its on-offer conversation', () => {
    const conditions = new ConditionsStore();
    conditions.set('start: default', 1);
    conditions.provideNamed('total ships', () => 1);
    conditions.providePrefixed('ships: ', () => 0);

    const { conversationNode, mission } = parseIntroMission(root, conditions);

    expect(mission.name).toBe(INTRO_MISSION_NAME);
    expect(mission.isOfferable()).toBe(true);
    expect(conversationNode).toBeTruthy();
    expect(conversationNode!.tokenOr(0)).toBe('conversation');
    expect(conversationNode!.tokenOr(1)).toBe('intro mission');
  });

  it('parses missions only from the default-start set', () => {
    const conditions = new ConditionsStore();
    const { mission } = parseIntroMission(root, conditions);
    expect(mission.landing).toBe(true);
    expect(mission.description).toContain('<destination>');
  });

  it('throws a clear error if the mission is missing', () => {
    const empty = parseData('mission "Something Else"\n\tname "Other"\n');
    expect(() => parseIntroMission(empty, new ConditionsStore())).toThrow(/Intro \[0\]/);
  });
});
