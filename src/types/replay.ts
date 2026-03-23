export type SupportLevel = 'direct' | 'derived' | 'inferred' | 'unsupported';

export type CameraMode = 'free' | 'followBall' | 'followPlayer' | 'tactical';

export type ReplayEventType =
  | 'goal'
  | 'shot'
  | 'save'
  | 'demo'
  | 'bump'
  | 'boost'
  | 'touch'
  | 'kickoff'
  | 'possession'
  | 'pressure'
  | 'aerial';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ReplayMeta {
  id: string;
  title: string;
  mapName: string;
  playlist: string;
  durationSeconds: number;
  frameRate: number;
  recordedAt: string;
  overtime: boolean;
  overtimeSeconds?: number;
  finalScore: {
    blue: number;
    orange: number;
  };
}

export interface Team {
  id: string;
  name: string;
  colorHex: string;
  score: number;
  playerIds: string[];
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  carName: string;
  isBot?: boolean;
  platform?: string;
}

export interface BallState {
  position: Vector3;
  velocity: Vector3;
}

export interface CarState {
  playerId: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  boost: number;
  airborne: boolean;
  demolished?: boolean;
  supersonic?: boolean;
}

export interface FrameState {
  time: number;
  ball: BallState;
  cars: CarState[];
}

export interface TouchEvent {
  id: string;
  time: number;
  playerId: string;
  teamId: string;
  position: Vector3;
  height: number;
  speed: number;
  aerial: boolean;
}

export interface GoalEvent {
  id: string;
  time: number;
  scorerId: string;
  teamId: string;
  assistId?: string;
  ownGoal?: boolean;
}

export interface ShotEvent {
  id: string;
  time: number;
  shooterId: string;
  teamId: string;
  onTarget: boolean;
  danger: number;
}

export interface SaveEvent {
  id: string;
  time: number;
  playerId: string;
  teamId: string;
  quality: number;
}

export interface DemoEvent {
  id: string;
  time: number;
  attackerId: string;
  victimId: string;
  teamId: string;
  position: Vector3;
}

export interface BumpEvent {
  id: string;
  time: number;
  attackerId: string;
  victimId: string;
  teamId: string;
  position: Vector3;
  intensity: number;
}

export interface BoostPickupEvent {
  id: string;
  time: number;
  playerId: string;
  teamId: string;
  padId: string;
  amount: number;
  position: Vector3;
  isLarge: boolean;
}

export interface PossessionSegment {
  id: string;
  startTime: number;
  endTime: number;
  teamId: string;
  playerId?: string;
  confidence: number;
}

export interface PressureWindow {
  id: string;
  startTime: number;
  endTime: number;
  teamId: string;
  intensity: number;
  reason: string;
}

export interface MetricScoreBreakdown {
  total: number;
  components: Record<string, number>;
  label: string;
  rationale: string;
}

export interface DerivedPlayerMetrics {
  playerId: string;
  teamId: string;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  touches: number;
  demos: number;
  averageSpeed: number;
  maxSpeed: number;
  timeInAir: number;
  timeSupersonic: number;
  boostCollected: number;
  boostSpentEstimate: number;
  boostEfficiency: number;
  aerialScore: MetricScoreBreakdown;
  movementScore: MetricScoreBreakdown;
  positioningScore: MetricScoreBreakdown;
  boostManagementScore: MetricScoreBreakdown;
  pressureScore: MetricScoreBreakdown;
  recoveryScore: MetricScoreBreakdown;
  challengeScore: MetricScoreBreakdown;
  rotationScore: MetricScoreBreakdown;
  shootingScore: MetricScoreBreakdown;
  defensiveReliabilityScore: MetricScoreBreakdown;
}

export interface DerivedTeamMetrics {
  teamId: string;
  possessionTime: number;
  offensiveHalfRatio: number;
  shots: number;
  goals: number;
  saves: number;
  demos: number;
  pressureScore: MetricScoreBreakdown;
}

export interface TimelineEvent {
  id: string;
  type: ReplayEventType;
  time: number;
  title: string;
  description: string;
  playerId?: string;
  teamId?: string;
  importance: number;
  supportLevel: SupportLevel;
}

export interface MetricFormulaDefinition {
  id: keyof Pick<
    DerivedPlayerMetrics,
    | 'aerialScore'
    | 'movementScore'
    | 'positioningScore'
    | 'boostManagementScore'
    | 'pressureScore'
    | 'recoveryScore'
    | 'challengeScore'
    | 'rotationScore'
    | 'shootingScore'
    | 'defensiveReliabilityScore'
  >;
  title: string;
  supportLevel: SupportLevel;
  formula: string;
  inputs: string[];
  weights: Record<string, number>;
  rationale: string;
}

export interface ReplaySource {
  fileName: string;
  fileSize: number;
  parser: string;
  importedAt: string;
  parseNotes: string[];
}

export interface NormalizedReplay {
  schemaVersion: string;
  replayHash: string;
  source: ReplaySource;
  meta: ReplayMeta;
  teams: Team[];
  players: Player[];
  frames: FrameState[];
  touches: TouchEvent[];
  goals: GoalEvent[];
  shots: ShotEvent[];
  saves: SaveEvent[];
  demos: DemoEvent[];
  bumps: BumpEvent[];
  boostPickups: BoostPickupEvent[];
  possessions: PossessionSegment[];
  pressureWindows: PressureWindow[];
  derived: {
    players: Record<string, DerivedPlayerMetrics>;
    teams: Record<string, DerivedTeamMetrics>;
    formulas: MetricFormulaDefinition[];
  };
  timeline: TimelineEvent[];
  support: Record<string, SupportLevel>;
  raw: unknown;
}

