import { normalizeReplay } from './normalize';
import { createMockReplay } from '../../sample-data/mockReplay';

describe('normalizeReplay', () => {
  it('sorts time-based collections and injects default support labels', () => {
    const replay = createMockReplay();
    const scrambled = {
      ...replay,
      frames: [...replay.frames].reverse(),
      goals: [...replay.goals].reverse(),
      timeline: [],
      derived: {
        players: {},
        teams: {},
        formulas: []
      },
      support: {
        'events.goals': 'direct' as const
      }
    };

    const normalized = normalizeReplay(scrambled);

    expect(normalized.frames[0].time).toBe(0);
    expect(normalized.goals[0].time).toBeLessThan(normalized.goals[1].time);
    expect(normalized.support['analytics.aerialScore']).toBe('derived');
    expect(normalized.timeline.length).toBeGreaterThan(0);
  });
});

