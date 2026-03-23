import type { NormalizedReplay } from '../../types/replay';
import { computeReplayAnalytics } from '../analytics/metrics';
import { buildTimelineEvents } from '../analytics/timeline';
import { withDefaultSupport } from './featureSupport';

const sortByTime = <T extends { time: number }>(items: T[]) => [...items].sort((a, b) => a.time - b.time);

export const normalizeReplay = (input: NormalizedReplay): NormalizedReplay => {
  const frames = [...input.frames].sort((a, b) => a.time - b.time);
  const metaDuration = input.meta.durationSeconds || frames.at(-1)?.time || 0;

  const normalized: NormalizedReplay = {
    ...input,
    meta: {
      ...input.meta,
      durationSeconds: metaDuration
    },
    frames,
    touches: sortByTime(input.touches),
    goals: sortByTime(input.goals),
    shots: sortByTime(input.shots),
    saves: sortByTime(input.saves),
    demos: sortByTime(input.demos),
    bumps: sortByTime(input.bumps),
    boostPickups: sortByTime(input.boostPickups),
    possessions: [...input.possessions].sort((a, b) => a.startTime - b.startTime),
    pressureWindows: [...input.pressureWindows].sort((a, b) => a.startTime - b.startTime),
    support: withDefaultSupport(input.support),
    timeline: input.timeline,
    derived: input.derived
  };

  const derived = computeReplayAnalytics(normalized);
  return {
    ...normalized,
    derived,
    timeline: buildTimelineEvents({ ...normalized, derived })
  };
};

