import type { NormalizedReplay, SupportLevel } from '../../types/replay';

export const FEATURE_SUPPORT_ORDER: SupportLevel[] = ['direct', 'derived', 'inferred', 'unsupported'];

export const DEFAULT_SUPPORT_MATRIX: Record<string, SupportLevel> = {
  'meta.matchMetadata': 'direct',
  'meta.map': 'direct',
  'meta.playlist': 'direct',
  'meta.playerNames': 'direct',
  'meta.teams': 'direct',
  'events.goals': 'direct',
  'events.assists': 'direct',
  'events.saves': 'direct',
  'events.shots': 'direct',
  'events.touches': 'derived',
  'events.demos': 'inferred',
  'events.bumps': 'inferred',
  'events.boostPickups': 'inferred',
  'events.kickoffs': 'derived',
  'events.possessions': 'inferred',
  'events.pressureWindows': 'inferred',
  'tracking.ballTransforms': 'derived',
  'tracking.carTransforms': 'derived',
  'tracking.speed': 'derived',
  'analytics.aerialScore': 'derived',
  'analytics.movementScore': 'derived',
  'analytics.positioningScore': 'inferred',
  'analytics.boostManagementScore': 'derived',
  'analytics.pressureScore': 'inferred',
  'analytics.recoveryScore': 'inferred',
  'analytics.challengeScore': 'inferred',
  'analytics.rotationScore': 'inferred',
  'analytics.shootingScore': 'derived',
  'analytics.defensiveReliabilityScore': 'derived',
  'viewer.trajectoryHighlights': 'unsupported'
};

export const withDefaultSupport = (support?: Record<string, SupportLevel>) => ({
  ...DEFAULT_SUPPORT_MATRIX,
  ...support
});

export const summarizeSupport = (replay: NormalizedReplay) =>
  Object.entries(withDefaultSupport(replay.support)).sort(
    (left, right) => FEATURE_SUPPORT_ORDER.indexOf(left[1]) - FEATURE_SUPPORT_ORDER.indexOf(right[1]),
  );

