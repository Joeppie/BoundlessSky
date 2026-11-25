// The flight model — the ship through the system, milestone-1/2 scoped.
// Pure, deterministic physics: momentum remains, max speed is capped, and the
// brake is a simplified reverse thrust. The numbers come from the ship's
// real data (thrust, drag, mass, cargo) — no invented constants.
//
// Formulas (the same ones the ship info table uses):
//   maxSpeed       = 60 × thrust / drag          (units/sec)
//   a_thrust       = 3600 × thrust / fullMass    (units/sec²)
//   a_drag         = a_thrust × speed / maxSpeed (linear drag — equilibrium at max speed)
//   brake          = 0.5 × a_thrust              (simplified reverse thrust — documented below)
//   turnRate       = 60 × turn / fullMass        (degrees/sec)

import type { Ship } from './Ship.ts';

export interface ShipPhysics {
  // The thrust and drag from the milestone ship (base attributes + installed
  // outfits, computed in src/game/ShipInfo.ts).
  thrust: number;
  drag: number;
  turn: number;
  // The ship's full mass (empty mass + base cargo space).
  fullMass: number;
  // 60 × thrust / drag.
  maxSpeed: number;
  // 3600 × thrust / fullMass.
  thrustAccel: number;
  // 60 × turn / fullMass.
  turnRate: number;
  // 0.5 × thrustAccel — the milestone's simplified reverse thrust.
  brakeAccel: number;
}

export function makeShipPhysics(ship: Ship, installedThrust: number, installedTurn: number, emptyMass: number): ShipPhysics {
  const fullMass = Math.max(emptyMass + ship.cargoSpace, 1);
  const maxSpeed = ship.drag > 0 && installedThrust > 0 ? (60 * installedThrust) / ship.drag : 0;
  const thrustAccel = emptyMass > 0 && installedThrust > 0 ? (3600 * installedThrust) / fullMass : 0;
  const turnRate = installedTurn > 0 ? (60 * installedTurn) / fullMass : 0;
  return {
    thrust: installedThrust,
    drag: ship.drag,
    turn: installedTurn,
    fullMass,
    maxSpeed,
    thrustAccel,
    turnRate,
    brakeAccel: 0.5 * thrustAccel,
  };
}

export interface FlightState {
  // Position in system units relative to the center (the star).
  x: number;
  y: number;
  // Velocity in system units per second.
  vx: number;
  vy: number;
  // Facing in radians (0 = east, CCW positive).
  facing: number;
  // Speed in units/sec.
  speed: number;
}

export interface FlightInput {
  thrust: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export const NO_INPUT: FlightInput = { thrust: false, brake: false, turnLeft: false, turnRight: false };

export function createFlightState(x: number, y: number, facing: number): FlightState {
  return { x, y, vx: 0, vy: 0, facing, speed: 0 };
}

export function speedOf(state: FlightState): number {
  return Math.hypot(state.vx, state.vy);
}

// One fixed-timestep step. Mutates `state` (in place) and returns it. The
// fixed dt is chosen so speed/position are stable: the flight view passes its
// own dt in seconds.
export function stepFlight(state: FlightState, input: FlightInput, physics: ShipPhysics, dt: number): FlightState {
  // Turning — capped at the ship's turn rate.
  const turnDelta = (input.turnLeft ? -1 : 0) + (input.turnRight ? 1 : 0);
  if (turnDelta !== 0) {
    state.facing += turnDelta * physics.turnRate * dt;
  }

  const speed = speedOf(state);
  let ax = 0;
  let ay = 0;

  // Thrust — the ship accelerates along its facing.
  if (input.thrust) {
    ax += Math.cos(state.facing) * physics.thrustAccel;
    ay += Math.sin(state.facing) * physics.thrustAccel;
  }

  // Brake — simplified reverse thrust along the direction of motion.
  if (input.brake && speed > 0) {
    const ux = state.vx / speed;
    const uy = state.vy / speed;
    ax -= ux * physics.brakeAccel;
    ay -= uy * physics.brakeAccel;
  }

  // Drag — linear, proportional to speed, opposing the velocity.
  if (speed > 0 && physics.maxSpeed > 0) {
    const dragAccel = physics.thrustAccel * (speed / physics.maxSpeed);
    ax -= (state.vx / speed) * dragAccel;
    ay -= (state.vy / speed) * dragAccel;
  }

  // Integrate.
  state.vx += ax * dt;
  state.vy += ay * dt;

  // Cap at max speed — momentum remains above the cap is unphysical, so the
  // speed is clamped rather than allowed to exceed max speed.
  const newSpeed = speedOf(state);
  if (newSpeed > physics.maxSpeed && physics.maxSpeed > 0) {
    const k = physics.maxSpeed / newSpeed;
    state.vx *= k;
    state.vy *= k;
  }
  state.speed = speedOf(state);
  state.x += state.vx * dt;
  state.y += state.vy * dt;
  return state;
}

// Can the ship warp? Only when nearly stopped (the milestone's "must break").
export function canWarp(state: FlightState, physics: ShipPhysics): boolean {
  if (physics.maxSpeed <= 0) return false;
  return state.speed < 0.05 * physics.maxSpeed;
}

// Can the ship land on a planet? Within the planet's landing zone AND nearly
// stopped. The land radius is a placement choice of the flight view (tied to
// the rendered planet glyph); the speed rule comes from the flight model.
export function canLand(state: FlightState, physics: ShipPhysics, planetX: number, planetY: number, landRadius: number): boolean {
  if (physics.maxSpeed <= 0) return false;
  const dist = Math.hypot(state.x - planetX, state.y - planetY);
  if (dist > landRadius) return false;
  return state.speed < 0.1 * physics.maxSpeed;
}

// Over a named planet — how far the ship is from the planet's center.
export function distanceToPlanet(state: FlightState, planetX: number, planetY: number): number {
  return Math.hypot(state.x - planetX, state.y - planetY);
}
