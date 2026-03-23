import type {
  BallState,
  BoostPickupEvent,
  BumpEvent,
  CarState,
  DemoEvent,
  FrameState,
  GoalEvent,
  NormalizedReplay,
  Player,
  PossessionSegment,
  PressureWindow,
  SaveEvent,
  ShotEvent,
  Team,
  TouchEvent,
  Vector3
} from '../types/replay';
import { normalizeReplay } from '../lib/parser/normalize';

const DURATION = 180;
const FRAME_STEP = 0.5;

const teams: Team[] = [
  { id: 'blue', name: 'Blue', colorHex: '#35c8ff', score: 2, playerIds: ['p1', 'p2'] },
  { id: 'orange', name: 'Orange', colorHex: '#ff8b35', score: 1, playerIds: ['p3', 'p4'] }
];

const players: Player[] = [
  { id: 'p1', name: 'Astra', teamId: 'blue', carName: 'Octane', platform: 'Steam' },
  { id: 'p2', name: 'Vector', teamId: 'blue', carName: 'Fennec', platform: 'Epic' },
  { id: 'p3', name: 'Nova', teamId: 'orange', carName: 'Dominus', platform: 'Steam' },
  { id: 'p4', name: 'Flux', teamId: 'orange', carName: 'Octane', platform: 'Epic' }
];

const motion = (time: number, radiusX: number, radiusY: number, phase: number): Vector3 => ({
  x: Math.sin(time / 11 + phase) * radiusX,
  y: Math.cos(time / 9 + phase) * radiusY,
  z: Math.max(0, 40 + Math.sin(time / 4 + phase) * 120)
});

const ballStateAt = (time: number): BallState => ({
  position: {
    x: Math.sin(time / 10) * 2400,
    y: Math.sin(time / 15) * 4200,
    z: Math.max(92, 260 + Math.sin(time / 2.5) * 340)
  },
  velocity: {
    x: Math.cos(time / 10) * 780,
    y: Math.cos(time / 15) * 950,
    z: Math.cos(time / 2.5) * 240
  }
});

const carStateAt = (player: Player, time: number, phase: number): CarState => {
  const position = motion(time, 2800 - phase * 100, 4200 - phase * 200, phase);
  const velocity = {
    x: Math.cos(time / 11 + phase) * 1100,
    y: -Math.sin(time / 9 + phase) * 1350,
    z: Math.cos(time / 4 + phase) * 60
  };

  return {
    playerId: player.id,
    position: {
      x: player.teamId === 'orange' ? -position.x : position.x,
      y: player.teamId === 'orange' ? -position.y : position.y,
      z: position.z
    },
    rotation: {
      x: Math.sin(time / 20 + phase) * 0.2,
      y: Math.cos(time / 18 + phase) * 0.4,
      z: Math.sin(time / 14 + phase) * 0.15
    },
    velocity,
    boost: 35 + (Math.sin(time / 5 + phase) + 1) * 30,
    airborne: position.z > 120,
    demolished: false,
    supersonic: Math.abs(velocity.x) + Math.abs(velocity.y) > 2200
  };
};

const createFrames = (): FrameState[] => {
  const frames: FrameState[] = [];
  for (let time = 0; time <= DURATION; time += FRAME_STEP) {
    frames.push({
      time,
      ball: ballStateAt(time),
      cars: players.map((player, index) => carStateAt(player, time, index + 1))
    });
  }
  return frames;
};

const createTouches = (): TouchEvent[] =>
  Array.from({ length: 70 }, (_, index) => {
    const time = 2 + index * 2.4;
    const player = players[index % players.length];
    const position = motion(time, 2600, 3900, index * 0.1);
    return {
      id: `touch-${index}`,
      time,
      playerId: player.id,
      teamId: player.teamId,
      position,
      height: Math.max(0, position.z),
      speed: 900 + (index % 6) * 220,
      aerial: position.z > 180 || index % 5 === 0
    };
  });

const goals: GoalEvent[] = [
  { id: 'goal-1', time: 34, scorerId: 'p1', teamId: 'blue', assistId: 'p2' },
  { id: 'goal-2', time: 92, scorerId: 'p3', teamId: 'orange' },
  { id: 'goal-3', time: 149, scorerId: 'p2', teamId: 'blue', assistId: 'p1' }
];

const shots: ShotEvent[] = [
  { id: 'shot-1', time: 30, shooterId: 'p1', teamId: 'blue', onTarget: true, danger: 0.75 },
  { id: 'shot-2', time: 63, shooterId: 'p3', teamId: 'orange', onTarget: false, danger: 0.58 },
  { id: 'shot-3', time: 90, shooterId: 'p3', teamId: 'orange', onTarget: true, danger: 0.82 },
  { id: 'shot-4', time: 128, shooterId: 'p2', teamId: 'blue', onTarget: true, danger: 0.61 },
  { id: 'shot-5', time: 149, shooterId: 'p2', teamId: 'blue', onTarget: true, danger: 0.86 }
];

const saves: SaveEvent[] = [
  { id: 'save-1', time: 65, playerId: 'p2', teamId: 'blue', quality: 0.78 },
  { id: 'save-2', time: 132, playerId: 'p4', teamId: 'orange', quality: 0.64 }
];

const demos: DemoEvent[] = [
  {
    id: 'demo-1',
    time: 48,
    attackerId: 'p3',
    victimId: 'p1',
    teamId: 'orange',
    position: { x: -820, y: 340, z: 22 }
  },
  {
    id: 'demo-2',
    time: 111,
    attackerId: 'p2',
    victimId: 'p4',
    teamId: 'blue',
    position: { x: 920, y: -520, z: 18 }
  }
];

const bumps: BumpEvent[] = [
  {
    id: 'bump-1',
    time: 24,
    attackerId: 'p1',
    victimId: 'p3',
    teamId: 'blue',
    position: { x: 380, y: 830, z: 18 },
    intensity: 0.66
  },
  {
    id: 'bump-2',
    time: 101,
    attackerId: 'p4',
    victimId: 'p2',
    teamId: 'orange',
    position: { x: -430, y: -740, z: 18 },
    intensity: 0.74
  }
];

const boostPickups: BoostPickupEvent[] = Array.from({ length: 24 }, (_, index) => {
  const player = players[index % players.length];
  return {
    id: `boost-${index}`,
    time: 6 + index * 7.2,
    playerId: player.id,
    teamId: player.teamId,
    padId: `pad-${index % 8}`,
    amount: index % 3 === 0 ? 100 : 12,
    position: motion(index * 6, 3100, 4200, index * 0.2),
    isLarge: index % 3 === 0
  };
});

const possessions: PossessionSegment[] = [
  { id: 'pos-1', startTime: 8, endTime: 18, teamId: 'blue', playerId: 'p1', confidence: 0.79 },
  { id: 'pos-2', startTime: 25, endTime: 38, teamId: 'blue', playerId: 'p2', confidence: 0.84 },
  { id: 'pos-3', startTime: 60, endTime: 71, teamId: 'orange', playerId: 'p3', confidence: 0.73 },
  { id: 'pos-4', startTime: 86, endTime: 97, teamId: 'orange', playerId: 'p3', confidence: 0.82 },
  { id: 'pos-5', startTime: 120, endTime: 134, teamId: 'blue', playerId: 'p2', confidence: 0.76 },
  { id: 'pos-6', startTime: 142, endTime: 154, teamId: 'blue', playerId: 'p1', confidence: 0.85 }
];

const pressureWindows: PressureWindow[] = [
  { id: 'press-1', startTime: 28, endTime: 38, teamId: 'blue', intensity: 0.8, reason: 'Sustained backboard pressure' },
  { id: 'press-2', startTime: 86, endTime: 95, teamId: 'orange', intensity: 0.76, reason: 'Shot and follow-up control' },
  { id: 'press-3', startTime: 142, endTime: 151, teamId: 'blue', intensity: 0.88, reason: 'Double-commit net-front pressure' }
];

export const createMockReplay = (): NormalizedReplay =>
  normalizeReplay({
    schemaVersion: '1.0.0',
    replayHash: 'demo-replayforge-session',
    source: {
      fileName: 'replayforge-demo.replay',
      fileSize: 0,
      parser: 'demo-generator',
      importedAt: new Date('2026-03-22T20:00:00.000Z').toISOString(),
      parseNotes: [
        'Demo session generated locally for UI development.',
        'This data is representative and should not be treated as official Rocket League telemetry.'
      ]
    },
    meta: {
      id: 'demo-match-001',
      title: 'Champions Field Scrim',
      mapName: 'Champions Field',
      playlist: 'Private Match 2v2',
      durationSeconds: DURATION,
      frameRate: 2,
      recordedAt: new Date('2026-03-21T20:00:00.000Z').toISOString(),
      overtime: false,
      finalScore: {
        blue: 2,
        orange: 1
      }
    },
    teams,
    players,
    frames: createFrames(),
    touches: createTouches(),
    goals,
    shots,
    saves,
    demos,
    bumps,
    boostPickups,
    possessions,
    pressureWindows,
    derived: {
      players: {},
      teams: {},
      formulas: []
    },
    timeline: [],
    support: {
      'events.demos': 'inferred',
      'events.boostPickups': 'inferred',
      'events.possessions': 'inferred',
      'events.pressureWindows': 'inferred',
      'tracking.ballTransforms': 'derived',
      'tracking.carTransforms': 'derived',
      'viewer.trajectoryHighlights': 'unsupported'
    },
    raw: {
      demo: true,
      generator: 'replayforge-demo-generator'
    }
  });

