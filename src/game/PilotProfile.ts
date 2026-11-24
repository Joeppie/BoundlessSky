// A pilot profile — the identity of a pilot: name (set later by the start
// conversation), gamerules and playtime.
//
// Faithful-enough subset of the reference's PilotProfile (endless-sky/source/
// PilotProfile.h/.cpp) — no file persistence for this milestone.

export interface Gamerules {
  // The default gamerules live in data/gamerules.txt (loaded later, Milestone 4).
  // These are the values the reference uses by default before the player customizes.
  maxEscortCount: number;
  maxEscortCrew: number;
  adminCap: number;
  locked: boolean;
}

export const DEFAULT_GAMERULES: Gamerules = {
  maxEscortCount: 0,
  maxEscortCrew: 0,
  adminCap: 1,
  locked: false,
};

export class PilotProfile {
  // The pilot's name (first and last), set by the start conversation.
  firstName = '';
  lastName = '';
  isLoaded = false;
  isLocked = false;
  gamerules: Gamerules = { ...DEFAULT_GAMERULES };

  constructor(gamerules?: Gamerules) {
    if (gamerules) this.gamerules = { ...gamerules };
  }

  new(gamerules?: Gamerules): void {
    if (gamerules) this.gamerules = { ...gamerules };
    this.isLoaded = true;
  }

  fullName(): string {
    const parts = [this.firstName, this.lastName].filter(s => s.length > 0);
    return parts.length ? parts.join(' ') : '(Unnamed pilot)';
  }
}
