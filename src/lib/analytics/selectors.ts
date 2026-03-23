import type {
  CarState,
  FrameState,
  NormalizedReplay,
  ReplayEventType,
  TimelineEvent
} from '../../types/replay';
import { lerp } from '../utils/math';

const interpolateCar = (from: CarState, to: CarState, alpha: number): CarState => ({
  ...from,
  position: {
    x: lerp(from.position.x, to.position.x, alpha),
    y: lerp(from.position.y, to.position.y, alpha),
    z: lerp(from.position.z, to.position.z, alpha)
  },
  rotation: {
    x: lerp(from.rotation.x, to.rotation.x, alpha),
    y: lerp(from.rotation.y, to.rotation.y, alpha),
    z: lerp(from.rotation.z, to.rotation.z, alpha)
  },
  velocity: {
    x: lerp(from.velocity.x, to.velocity.x, alpha),
    y: lerp(from.velocity.y, to.velocity.y, alpha),
    z: lerp(from.velocity.z, to.velocity.z, alpha)
  },
  boost: lerp(from.boost, to.boost, alpha)
});

const interpolateFrame = (from: FrameState, to: FrameState, alpha: number): FrameState => ({
  time: lerp(from.time, to.time, alpha),
  ball: {
    position: {
      x: lerp(from.ball.position.x, to.ball.position.x, alpha),
      y: lerp(from.ball.position.y, to.ball.position.y, alpha),
      z: lerp(from.ball.position.z, to.ball.position.z, alpha)
    },
    velocity: {
      x: lerp(from.ball.velocity.x, to.ball.velocity.x, alpha),
      y: lerp(from.ball.velocity.y, to.ball.velocity.y, alpha),
      z: lerp(from.ball.velocity.z, to.ball.velocity.z, alpha)
    }
  },
  cars: from.cars.map((car) => {
    const next = to.cars.find((entry) => entry.playerId === car.playerId) ?? car;
    return interpolateCar(car, next, alpha);
  })
});

export const getInterpolatedFrameAtTime = (replay: NormalizedReplay, time: number) => {
  if (!replay.frames.length) {
    return null;
  }

  const clampedTime = Math.max(0, Math.min(time, replay.meta.durationSeconds));
  const nextIndex = replay.frames.findIndex((frame) => frame.time >= clampedTime);

  if (nextIndex <= 0) {
    return replay.frames[0];
  }

  const previous = replay.frames[nextIndex - 1];
  const next = replay.frames[nextIndex] ?? previous;
  const span = Math.max(next.time - previous.time, Number.EPSILON);
  return interpolateFrame(previous, next, (clampedTime - previous.time) / span);
};

export const getVisibleTimelineEvents = (
  replay: NormalizedReplay,
  filters: Record<ReplayEventType, boolean>,
): TimelineEvent[] => replay.timeline.filter((event) => filters[event.type]);

export const getStandoutPlayers = (replay: NormalizedReplay) =>
  [...replay.players]
    .map((player) => ({
      player,
      metrics: replay.derived.players[player.id]
    }))
    .sort((left, right) => {
      const leftScore =
        left.metrics.movementScore.total +
        left.metrics.aerialScore.total +
        left.metrics.shootingScore.total +
        left.metrics.defensiveReliabilityScore.total;
      const rightScore =
        right.metrics.movementScore.total +
        right.metrics.aerialScore.total +
        right.metrics.shootingScore.total +
        right.metrics.defensiveReliabilityScore.total;
      return rightScore - leftScore;
    });

