import { computeReplayAnalytics } from './metrics';
import { createMockReplay } from '../../sample-data/mockReplay';

describe('computeReplayAnalytics', () => {
  it('computes player and team metrics for a normalized replay', () => {
    const replay = createMockReplay();
    const analytics = computeReplayAnalytics(replay);

    expect(Object.keys(analytics.players)).toHaveLength(replay.players.length);
    expect(analytics.players.p1.goals).toBeGreaterThanOrEqual(1);
    expect(analytics.players.p1.movementScore.total).toBeGreaterThan(0);
    expect(analytics.players.p2.boostEfficiency).toBeGreaterThan(0);
    expect(analytics.teams.blue.possessionTime).toBeGreaterThan(0);
    expect(analytics.formulas).toHaveLength(10);
  });
});

