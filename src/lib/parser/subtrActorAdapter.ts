import initSubtrActor, {
  get_ndarray_with_info,
  get_replay_frames_data,
  validate_replay,
} from 'rl-replay-subtr-actor';
import type {
  BoostPickupEvent,
  DemoEvent,
  FrameState,
  GoalEvent,
  NormalizedReplay,
  Player,
  PossessionSegment,
  PressureWindow,
  SaveEvent,
  ShotEvent,
  SupportLevel,
  Team,
  TouchEvent,
  Vector3,
} from '../../types/replay';
import { FIELD_DIMENSIONS } from '../utils/field';
import { clamp, magnitude } from '../utils/math';
import type { BrowserReplayAdapter } from './replayParser';

type UnknownMapLike = Map<unknown, unknown> | Record<string, unknown> | unknown;

interface ParseReplayInput {
  fileName: string;
  fileSize: number;
  buffer: ArrayBuffer;
}

interface ParsedPlayerSource {
  player: Player;
  remoteKey: string;
  stats: Record<string, unknown>;
}

const BALL_HEADER_COUNT = 12;
const DEFAULT_FPS = 10;
const GOAL_LINE_Y = FIELD_DIMENSIONS.halfLength - 180;

let initPromise: Promise<unknown> | null = null;

const ensureWasmInit = () => {
  if (!initPromise) {
    initPromise = initSubtrActor();
  }

  return initPromise;
};

const isMap = (value: unknown): value is Map<unknown, unknown> => value instanceof Map;

const getValue = <T = unknown>(container: UnknownMapLike, key: string): T | undefined => {
  if (isMap(container)) {
    return container.get(key) as T | undefined;
  }

  if (container && typeof container === 'object' && key in container) {
    return (container as Record<string, T>)[key];
  }

  return undefined;
};

const getEntries = (container: UnknownMapLike): Array<[string, unknown]> => {
  if (isMap(container)) {
    return [...container.entries()].map(([key, value]) => [String(key), value]);
  }

  if (container && typeof container === 'object') {
    return Object.entries(container as Record<string, unknown>);
  }

  return [];
};

const getList = <T = unknown>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  return [];
};

const toPlainObject = (value: UnknownMapLike): Record<string, unknown> => Object.fromEntries(getEntries(value));

const tupleListToObject = (value: unknown): Record<string, unknown> =>
  Array.isArray(value) ? Object.fromEntries(value as Array<[string, unknown]>) : toPlainObject(value);

const titleCaseMapName = (mapName: string) =>
  mapName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseDateHeader = (raw: string | undefined) => {
  if (!raw) {
    return new Date().toISOString();
  }

  const normalized = raw.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})/, '$1-$2-$3T$4:$5:$6');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const remoteKeyFromSource = (remoteId: unknown, fallback: string) => {
  const [platform, value] = getEntries(remoteId)[0] ?? ['Unknown', fallback];
  if (value && typeof value === 'object') {
    const nested = toPlainObject(value);
    const nestedId = (nested.online_id ?? nested.name ?? fallback) as string;
    return `${platform}:${nestedId}`;
  }

  return `${platform}:${String(value ?? fallback)}`;
};

const platformFromSource = (remoteId: unknown) => getEntries(remoteId)[0]?.[0] ?? 'Unknown';

const buildPlayers = (
  sources: unknown[],
  teamId: string,
  teamLabel: string,
): ParsedPlayerSource[] =>
  sources.map((source, index) => {
    const name = String(getValue(source, 'name') ?? `${teamLabel} Player ${index + 1}`);
    const stats = toPlainObject(getValue(source, 'stats'));
    const remoteId = getValue(source, 'remote_id');
    const remoteKey = remoteKeyFromSource(remoteId, `${teamId}-${index}-${name}`);
    return {
      remoteKey,
      stats,
      player: {
        id: `${teamId}-${index}`,
        name,
        teamId,
        carName: 'Unknown',
        isBot: Boolean(stats.bBot),
        platform: platformFromSource(remoteId),
      },
    };
  });

const vector = (x = 0, y = 0, z = 0): Vector3 => ({ x, y, z });

const uniqueByTime = <T extends { time: number; id: string }>(items: T[], minGap = 0.35) => {
  const result: T[] = [];
  for (const item of items.sort((left, right) => left.time - right.time)) {
    const previous = result.at(-1);
    if (!previous || Math.abs(previous.time - item.time) >= minGap || previous.id === item.id) {
      result.push(item);
    }
  }
  return result;
};

const distance = (left: Vector3, right: Vector3) =>
  Math.sqrt((left.x - right.x) ** 2 + (left.y - right.y) ** 2 + (left.z - right.z) ** 2);

const nearestTouchPlayer = (frame: FrameState) => {
  const distances = frame.cars.map((car) => ({
    car,
    distance: distance(car.position, frame.ball.position),
  }));

  return distances.sort((left, right) => left.distance - right.distance)[0];
};

const inferTouches = (frames: FrameState[], players: Player[]): TouchEvent[] => {
  const result: TouchEvent[] = [];
  let lastTouchTime = -Infinity;
  let lastTouchPlayerId: string | null = null;

  for (const frame of frames) {
    const nearest = nearestTouchPlayer(frame);
    if (!nearest) {
      continue;
    }

    const touchRadius = 390 + Math.min(frame.ball.position.z, 450) * 0.18;
    const speed = magnitude(frame.ball.velocity);
    const shouldRegister =
      nearest.distance < touchRadius &&
      (nearest.car.playerId !== lastTouchPlayerId || frame.time - lastTouchTime > 0.45 || speed > 1200);

    if (!shouldRegister) {
      continue;
    }

    const player = players.find((entry) => entry.id === nearest.car.playerId);
    if (!player) {
      continue;
    }

    result.push({
      id: `touch-${result.length}`,
      time: frame.time,
      playerId: player.id,
      teamId: player.teamId,
      position: frame.ball.position,
      height: frame.ball.position.z,
      speed,
      aerial: frame.ball.position.z > 300,
    });
    lastTouchTime = frame.time;
    lastTouchPlayerId = player.id;
  }

  return uniqueByTime(result);
};

const inferBoostPickups = (frames: FrameState[], players: Player[]): BoostPickupEvent[] => {
  const events: BoostPickupEvent[] = [];

  for (const player of players) {
    for (let index = 1; index < frames.length; index += 1) {
      const previous = frames[index - 1].cars.find((car) => car.playerId === player.id);
      const current = frames[index].cars.find((car) => car.playerId === player.id);
      if (!previous || !current) {
        continue;
      }

      const delta = current.boost - previous.boost;
      if (delta < 8) {
        continue;
      }

      events.push({
        id: `boost-${player.id}-${events.length}`,
        time: frames[index].time,
        playerId: player.id,
        teamId: player.teamId,
        padId: delta > 30 ? 'large-pad' : 'small-pad',
        amount: delta,
        position: current.position,
        isLarge: delta > 30,
      });
    }
  }

  return uniqueByTime(events, 0.25);
};

const buildPossessions = (touches: TouchEvent[]): PossessionSegment[] => {
  if (!touches.length) {
    return [];
  }

  const possessions: PossessionSegment[] = [];
  let start = touches[0];
  let end = touches[0];

  for (let index = 1; index < touches.length; index += 1) {
    const touch = touches[index];
    if (touch.teamId === start.teamId && touch.playerId === start.playerId && touch.time - end.time <= 5) {
      end = touch;
      continue;
    }

    possessions.push({
      id: `pos-${possessions.length}`,
      startTime: start.time,
      endTime: Math.max(end.time, start.time + 0.1),
      teamId: start.teamId,
      playerId: start.playerId,
      confidence: clamp((end.time - start.time) / 6, 0.55, 0.9),
    });
    start = touch;
    end = touch;
  }

  possessions.push({
    id: `pos-${possessions.length}`,
    startTime: start.time,
    endTime: Math.max(end.time, start.time + 0.1),
    teamId: start.teamId,
    playerId: start.playerId,
    confidence: clamp((end.time - start.time) / 6, 0.55, 0.9),
  });

  return possessions;
};

const buildPressureWindows = (possessions: PossessionSegment[], playersById: Record<string, Player>): PressureWindow[] =>
  possessions
    .filter((segment) => segment.endTime - segment.startTime >= 3)
    .map((segment, index) => ({
      id: `pressure-${index}`,
      startTime: segment.startTime,
      endTime: segment.endTime,
      teamId: segment.teamId,
      intensity: clamp((segment.endTime - segment.startTime) / 10, 0.5, 0.95),
      reason: `${playersById[segment.playerId ?? '']?.name ?? 'Team'} sustained controlled touches`,
    }));

const detectGoalTimes = (frames: FrameState[]) => {
  const candidates: number[] = [];

  for (const frame of frames) {
    if (Math.abs(frame.ball.position.y) > GOAL_LINE_Y && frame.ball.position.z < 900) {
      const previous = candidates.at(-1);
      if (previous === undefined || frame.time - previous > 2.5) {
        candidates.push(frame.time);
      }
    }
  }

  return candidates;
};

const pickFallbackTimes = (touches: TouchEvent[], count: number, durationSeconds: number) => {
  if (!touches.length) {
    return Array.from({ length: count }, (_, index) => ((index + 1) / (count + 1)) * durationSeconds);
  }

  return touches
    .filter((_, index) => index % Math.max(1, Math.floor(touches.length / count)) === 0)
    .slice(0, count)
    .map((touch) => touch.time);
};

const assignGoalEvents = (
  goalTimes: number[],
  players: ParsedPlayerSource[],
  touches: TouchEvent[],
  teamScores: Record<string, number>,
): GoalEvent[] => {
  const teamGoalPools = Object.fromEntries(
    ['blue', 'orange'].map((teamId) => {
      const pool = players
        .filter((entry) => entry.player.teamId === teamId)
        .flatMap((entry) => Array.from({ length: Number(entry.stats.Goals ?? 0) }, () => entry.player.id));
      return [teamId, pool];
    }),
  ) as Record<string, string[]>;

  const groupedByTeam = Object.fromEntries(['blue', 'orange'].map((teamId) => [teamId, [] as number[]])) as Record<
    string,
    number[]
  >;
  for (const time of goalTimes) {
    const lastTouch = [...touches].reverse().find((touch) => touch.time <= time);
    const teamId =
      lastTouch?.teamId ??
      (time % 2 === 0 ? 'blue' : 'orange');
    groupedByTeam[teamId].push(time);
  }

  for (const teamId of ['blue', 'orange']) {
    while (groupedByTeam[teamId].length < (teamScores[teamId] ?? 0)) {
      const fallbackTime = pickFallbackTimes(
        touches.filter((touch) => touch.teamId === teamId),
        (teamScores[teamId] ?? 0) - groupedByTeam[teamId].length,
        Math.max(...goalTimes, 60),
      )[0];
      groupedByTeam[teamId].push(fallbackTime);
    }
  }

  return (['blue', 'orange'] as const)
    .flatMap((teamId) =>
      groupedByTeam[teamId]
        .sort((left, right) => left - right)
        .slice(0, teamScores[teamId] ?? 0)
        .map((time, index) => {
          const recentTouches = touches.filter((touch) => touch.teamId === teamId && touch.time <= time).slice(-3);
          const candidateScorer = [...recentTouches]
            .reverse()
            .find((touch) => teamGoalPools[teamId].includes(touch.playerId))?.playerId;
          const scorerId = candidateScorer ?? teamGoalPools[teamId].shift() ?? players.find((entry) => entry.player.teamId === teamId)?.player.id;
          if (scorerId) {
            const scorerIndex = teamGoalPools[teamId].indexOf(scorerId);
            if (scorerIndex >= 0) {
              teamGoalPools[teamId].splice(scorerIndex, 1);
            }
          }

          const assistTouch = recentTouches.find((touch) => touch.playerId !== scorerId)?.playerId;
          return {
            id: `goal-${teamId}-${index}`,
            time,
            scorerId: scorerId ?? players.find((entry) => entry.player.teamId === teamId)?.player.id ?? 'unknown',
            teamId,
            assistId: assistTouch,
          } satisfies GoalEvent;
        }),
    )
    .sort((left, right) => left.time - right.time);
};

const buildShotCandidates = (touches: TouchEvent[]) =>
  touches
    .filter((touch) =>
      touch.teamId === 'blue'
        ? touch.position.y > 0 && touch.speed > 900
        : touch.position.y < 0 && touch.speed > 900,
    )
    .map((touch) => ({
      touch,
      danger: clamp(Math.abs(touch.position.y) / FIELD_DIMENSIONS.halfLength, 0.2, 1),
    }));

const buildSaveCandidates = (touches: TouchEvent[]) =>
  touches
    .filter((touch) =>
      touch.teamId === 'blue'
        ? touch.position.y < -2800 && touch.speed > 700
        : touch.position.y > 2800 && touch.speed > 700,
    )
    .map((touch) => ({
      touch,
      quality: clamp(Math.abs(touch.position.y) / FIELD_DIMENSIONS.halfLength, 0.35, 1),
    }));

const synthesizeTimedEvents = <T extends { id: string; time: number }>(
  candidates: T[],
  targetCount: number,
  fallbackFactory: (index: number) => T,
) => {
  const result = [...candidates].slice(0, targetCount);
  while (result.length < targetCount) {
    result.push(fallbackFactory(result.length));
  }
  return result;
};

const buildShotEvents = (
  touches: TouchEvent[],
  players: ParsedPlayerSource[],
  goals: GoalEvent[],
): ShotEvent[] => {
  const candidates = buildShotCandidates(touches);
  return players.flatMap((entry) => {
    const playerCandidates = candidates
      .filter((candidate) => candidate.touch.playerId === entry.player.id)
      .sort((left, right) => right.danger - left.danger || left.touch.time - right.touch.time)
      .map(
        (candidate, index) =>
          ({
            id: `shot-${entry.player.id}-${index}`,
            time: candidate.touch.time,
            shooterId: entry.player.id,
            teamId: entry.player.teamId,
            onTarget: goals.some((goal) => goal.teamId === entry.player.teamId && goal.time >= candidate.touch.time && goal.time - candidate.touch.time <= 8),
            danger: candidate.danger,
          }) satisfies ShotEvent,
      );

    return synthesizeTimedEvents(playerCandidates, Number(entry.stats.Shots ?? 0), (index) => ({
      id: `shot-${entry.player.id}-synthetic-${index}`,
      time: touches.find((touch) => touch.playerId === entry.player.id)?.time ?? index * 15,
      shooterId: entry.player.id,
      teamId: entry.player.teamId,
      onTarget: false,
      danger: 0.45,
    }));
  });
};

const buildSaveEvents = (touches: TouchEvent[], players: ParsedPlayerSource[]): SaveEvent[] => {
  const candidates = buildSaveCandidates(touches);
  return players.flatMap((entry) => {
    const playerCandidates = candidates
      .filter((candidate) => candidate.touch.playerId === entry.player.id)
      .sort((left, right) => right.quality - left.quality || left.touch.time - right.touch.time)
      .map(
        (candidate, index) =>
          ({
            id: `save-${entry.player.id}-${index}`,
            time: candidate.touch.time,
            playerId: entry.player.id,
            teamId: entry.player.teamId,
            quality: candidate.quality,
          }) satisfies SaveEvent,
      );

    return synthesizeTimedEvents(playerCandidates, Number(entry.stats.Saves ?? 0), (index) => ({
      id: `save-${entry.player.id}-synthetic-${index}`,
      time: touches.find((touch) => touch.playerId === entry.player.id)?.time ?? index * 17,
      playerId: entry.player.id,
      teamId: entry.player.teamId,
      quality: 0.45,
    }));
  });
};

const buildDemoEvents = (demolishInfos: unknown[], playersByRemoteKey: Record<string, ParsedPlayerSource>): DemoEvent[] =>
  demolishInfos.map((info, index) => {
    const attacker = remoteKeyFromSource(getValue(info, 'attacker'), `demo-attacker-${index}`);
    const victim = remoteKeyFromSource(getValue(info, 'victim'), `demo-victim-${index}`);
    const attackerPlayer = playersByRemoteKey[attacker];
    const victimPlayer = playersByRemoteKey[victim];
    const location = toPlainObject(getValue(info, 'victim_location'));
    return {
      id: `demo-${index}`,
      time: Number(getValue(info, 'time') ?? index),
      attackerId: attackerPlayer?.player.id ?? `attacker-${index}`,
      victimId: victimPlayer?.player.id ?? `victim-${index}`,
      teamId: attackerPlayer?.player.teamId ?? 'blue',
      position: vector(
        Number(location.x ?? 0),
        Number(location.y ?? 0),
        Number(location.z ?? 0),
      ),
    };
  });

const buildFrames = (
  rows: number[][],
  players: Player[],
  playerHeaderCount: number,
  rowDurationSeconds: number,
): FrameState[] =>
  rows.map((row, index) => ({
    time: index * rowDurationSeconds,
    ball: {
      position: vector(row[0], row[1], row[2]),
      velocity: vector(row[6], row[7], row[8]),
    },
    cars: players.map((player, playerIndex) => {
      const start = BALL_HEADER_COUNT + playerIndex * playerHeaderCount;
      const velocity = vector(row[start + 6], row[start + 7], row[start + 8]);
      return {
        playerId: player.id,
        position: vector(row[start], row[start + 1], row[start + 2]),
        rotation: vector(row[start + 3], row[start + 4], row[start + 5]),
        velocity,
        boost: clamp((row[start + 12] / 255) * 100, 0, 100),
        airborne: Boolean(row[start + 13]) || row[start + 2] > 150,
        supersonic: magnitude(velocity) > 2200,
      };
    }),
  }));

const buildSupportOverrides = (): Record<string, SupportLevel> => ({
  'events.goals': 'inferred',
  'events.assists': 'inferred',
  'events.saves': 'inferred',
  'events.shots': 'inferred',
  'events.touches': 'inferred',
  'events.demos': 'direct',
  'events.bumps': 'unsupported',
  'events.boostPickups': 'inferred',
  'events.possessions': 'inferred',
  'events.pressureWindows': 'inferred',
  'tracking.ballTransforms': 'direct',
  'tracking.carTransforms': 'direct',
  'tracking.speed': 'derived',
  'viewer.trajectoryHighlights': 'unsupported',
});

export const subtrActorReplayAdapter: BrowserReplayAdapter = {
  id: 'rl-replay-subtr-actor',
  async parse(input: ParseReplayInput): Promise<NormalizedReplay | null> {
    await ensureWasmInit();
    const replayBytes = new Uint8Array(input.buffer);
    validate_replay(replayBytes);

    const ndarrayResult = get_ndarray_with_info(
      replayBytes,
      ['BallRigidBody'],
      ['PlayerRigidBody', 'PlayerBoost', 'PlayerAnyJump'],
      DEFAULT_FPS,
    );
    const framesDataResult = get_replay_frames_data(replayBytes);

    const rows = (getValue<number[][]>(ndarrayResult, 'array_data') ?? []) as number[][];
    const metadata = getValue(ndarrayResult, 'metadata');
    const columnHeaders = getValue(metadata, 'column_headers');
    const replayMeta = getValue(metadata, 'replay_meta');
    const allHeaders = tupleListToObject(getValue(replayMeta, 'all_headers'));
    const teamZeroSources = buildPlayers(getList(getValue(replayMeta, 'team_zero')), 'blue', 'Blue');
    const teamOneSources = buildPlayers(getList(getValue(replayMeta, 'team_one')), 'orange', 'Orange');
    const parsedPlayers = [...teamZeroSources, ...teamOneSources];
    const players = parsedPlayers.map((entry) => entry.player);
    const playersById = Object.fromEntries(players.map((player) => [player.id, player]));
    const playersByRemoteKey = Object.fromEntries(parsedPlayers.map((entry) => [entry.remoteKey, entry]));

    const teams: Team[] = [
      {
        id: 'blue',
        name: 'Blue',
        colorHex: '#35c8ff',
        score: Number(allHeaders.Team0Score ?? teamZeroSources.reduce((sum, player) => sum + Number(player.stats.Goals ?? 0), 0)),
        playerIds: teamZeroSources.map((entry) => entry.player.id),
      },
      {
        id: 'orange',
        name: 'Orange',
        colorHex: '#ff8b35',
        score: teamOneSources.reduce((sum, player) => sum + Number(player.stats.Goals ?? 0), 0),
        playerIds: teamOneSources.map((entry) => entry.player.id),
      },
    ];

    const playerHeaders = getList<string>(getValue(columnHeaders, 'player_headers'));
    const metadataFrames = getValue(getValue(framesDataResult, 'frame_data'), 'metadata_frames');
    const metadataFrameTimes = getEntries(metadataFrames)
      .map(([, frame]) => Number(getValue(frame, 'time') ?? 0))
      .filter((time) => Number.isFinite(time));
    const rawSpanSeconds =
      metadataFrameTimes.length > 1
        ? metadataFrameTimes.at(-1)! - metadataFrameTimes[0]!
        : rows.length / DEFAULT_FPS;
    const frameDurationSeconds = rawSpanSeconds > 0 ? rawSpanSeconds / Math.max(1, rows.length - 1) : 1 / DEFAULT_FPS;
    const frames = buildFrames(rows, players, playerHeaders.length, frameDurationSeconds);
    const touches = inferTouches(frames, players);
    const goals = assignGoalEvents(
      detectGoalTimes(frames),
      parsedPlayers,
      touches,
      { blue: teams[0].score, orange: teams[1].score },
    );
    const shots = buildShotEvents(touches, parsedPlayers, goals);
    const saves = buildSaveEvents(touches, parsedPlayers);
    const demos = buildDemoEvents(getList(getValue(framesDataResult, 'demolish_infos')), playersByRemoteKey);
    const boostPickups = inferBoostPickups(frames, players);
    const possessions = buildPossessions(touches);
    const pressureWindows = buildPressureWindows(possessions, playersById);

    const durationSeconds = frames.at(-1)?.time ?? Number(allHeaders.TotalSecondsPlayed ?? 0);

    return {
      schemaVersion: '1.0.0',
      replayHash: '',
      source: {
        fileName: input.fileName,
        fileSize: input.fileSize,
        parser: 'rl-replay-subtr-actor',
        importedAt: new Date().toISOString(),
        parseNotes: [
          'Replay parsed locally in-browser via WASM.',
          'Goal, shot, save, touch, possession, pressure, and boost-pickup timing may be inferred from replay state and direct summary stats.',
          'Bump events are not currently exposed by the adapter and remain unsupported.',
        ],
      },
      meta: {
        id: String(allHeaders.Id ?? input.fileName),
        title: `${titleCaseMapName(String(allHeaders.MapName ?? 'Rocket League Match'))} • ${input.fileName.replace(/\.replay$/i, '')}`,
        mapName: titleCaseMapName(String(allHeaders.MapName ?? 'Unknown Arena')),
        playlist: `${String(allHeaders.MatchType ?? 'Replay')} ${Number(allHeaders.TeamSize ?? 0)}v${Number(allHeaders.TeamSize ?? 0)}`,
        durationSeconds,
        frameRate: DEFAULT_FPS,
        recordedAt: parseDateHeader(String(allHeaders.Date ?? '')),
        overtime: durationSeconds > 300,
        overtimeSeconds: durationSeconds > 300 ? durationSeconds - 300 : 0,
        finalScore: {
          blue: teams[0].score,
          orange: teams[1].score,
        },
      },
      teams,
      players,
      frames,
      touches,
      goals,
      shots,
      saves,
      demos,
      bumps: [],
      boostPickups,
      possessions,
      pressureWindows,
      derived: {
        players: {},
        teams: {},
        formulas: [],
      },
      timeline: [],
      support: buildSupportOverrides(),
      raw: {
        parser: 'rl-replay-subtr-actor',
        headers: allHeaders,
        teamStats: parsedPlayers.map((entry) => ({
          playerId: entry.player.id,
          name: entry.player.name,
          stats: entry.stats,
        })),
        demolitions: demos.length,
      },
    };
  },
};
