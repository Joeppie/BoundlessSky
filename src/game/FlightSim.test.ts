import { describe, expect, it } from 'vitest';
import {
  makeShipPhysics,
  createFlightState,
  stepFlight,
  speedOf,
  canWarp,
  canLand,
  distanceToPlanet,
  NO_INPUT,
  type ShipPhysics,
} from './FlightSim.ts';
import type { Ship } from './Ship.ts';

// Physics mirror the Star Barge's real values from ships.txt + the installed
// outfits: thrust 13.545 (X1700 Ion Thruster), turn 288 (X1200 Ion Steering),
// drag 2.2, mass 199 (empty: base 80 + outfits) + 50 cargo = 249 full.
const ship = {
  name: 'Star Barge',
  sprite: null,
  thumbnail: null,
  category: 'Light Freighter',
  cost: 190000,
  shields: 600,
  hull: 1000,
  requiredCrew: 1,
  bunks: 3,
  mass: 80,
  drag: 2.2,
  heatDissipation: 0.77,
  fuelCapacity: 300,
  cargoSpace: 50,
  outfitSpace: 130,
  weaponCapacity: 20,
  engineCapacity: 40,
  gunPorts: 0,
  turretMounts: 1,
  outfits: [],
  isValid: true,
} as Ship;
const emptyMass = 80 + 16 + 30 + 10 + 15 + 20 + 16 + 12; // 199
const physics = makeShipPhysics(ship, 13.545, 288, emptyMass);

describe('ShipPhysics', () => {
  it('computes max speed and thrust acceleration from the real data', () => {
    expect(physics.maxSpeed).toBeCloseTo(60 * 13.545 / 2.2, 1);
    expect(physics.thrustAccel).toBeCloseTo(3600 * 13.545 / 249, 1);
    expect(physics.brakeAccel).toBeCloseTo(0.5 * physics.thrustAccel, 1);
    expect(physics.turnRate).toBeCloseTo(60 * 288 / 249, 1);
  });
});

describe('stepFlight', () => {
  it('momentum remains: releasing thrust does not stop the ship', () => {
    const state = createFlightState(513.86, 0, 0);
    stepFlight(state, { ...NO_INPUT, thrust: true }, physics, 1);
    expect(state.speed).toBeGreaterThan(100);
    const speedAtRelease = state.speed;
    stepFlight(state, NO_INPUT, physics, 0.5);
    // Coasting: the ship still moves, decelerating through drag.
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeLessThan(speedAtRelease);
  });

  it('caps the speed at max speed', () => {
    const state = createFlightState(513.86, 0, 0);
    for (let i = 0; i < 400; i += 1) {
      stepFlight(state, { ...NO_INPUT, thrust: true }, physics, 0.05);
    }
    // Converges toward max speed (linear drag — the equilibrium is at the cap).
    expect(state.speed).toBeGreaterThan(0.98 * physics.maxSpeed);
    expect(speedOf(state)).toBeLessThanOrEqual(physics.maxSpeed + 0.01);
  });

  it('brake decelerates the ship', () => {
    const state = createFlightState(513.86, 0, 0);
    for (let i = 0; i < 200; i += 1) {
      stepFlight(state, { ...NO_INPUT, thrust: true }, physics, 0.05);
    }
    const before = state.speed;
    for (let i = 0; i < 100; i += 1) {
      stepFlight(state, { ...NO_INPUT, brake: true }, physics, 0.05);
    }
    expect(state.speed).toBeLessThan(before / 2);
  });

  it('turns the ship (turning rate from the data)', () => {
    const state = createFlightState(513.86, 0, 0);
    const startFacing = state.facing;
    stepFlight(state, { ...NO_INPUT, turnRight: true }, physics, 1);
    expect(state.facing).toBeGreaterThan(startFacing + 1); // > 57°
  });

  it('canWarp requires the ship to be stopped (break first)', () => {
    const stopped = createFlightState(513.86, 0, 0);
    expect(canWarp(stopped, physics)).toBe(true);

    const moving = createFlightState(513.86, 0, 0);
    stepFlight(moving, { ...NO_INPUT, thrust: true }, physics, 0.5);
    expect(canWarp(moving, physics)).toBe(false);
  });

  it('canLand requires the ship to be over the planet and slow', () => {
    const over = createFlightState(513.86, 0, 0);
    const onPlanet = { x: 513.86, y: 0 };
    expect(canLand(over, physics, onPlanet.x, onPlanet.y, 50)).toBe(true);

    const far = createFlightState(513.86 + 300, 0, 0);
    expect(canLand(far, physics, onPlanet.x, onPlanet.y, 50)).toBe(false);

    const fast = createFlightState(513.86, 0, 0);
    stepFlight(fast, { ...NO_INPUT, thrust: true }, physics, 1);
    expect(canLand(fast, physics, onPlanet.x, onPlanet.y, 50)).toBe(false);
  });

  it('canLand also works when the ship is at the planet centre but fast', () => {
    const fast = createFlightState(513.86, 0, 0);
    stepFlight(fast, { ...NO_INPUT, thrust: true }, physics, 0.6);
    expect(canLand(fast, physics, 513.86, 0, 50)).toBe(false);
  });

  it('reports the distance to the planet', () => {
    const state = createFlightState(513.86 + 100, 0, 0);
    expect(distanceToPlanet(state, 513.86, 0)).toBeCloseTo(100, 1);
  });
});
