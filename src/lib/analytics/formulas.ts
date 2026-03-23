import type { MetricFormulaDefinition } from '../../types/replay';

// These are custom ReplayForge metrics. They are replay-derived heuristics, not official Rocket League stats.
export const metricFormulaDefinitions: MetricFormulaDefinition[] = [
  {
    id: 'aerialScore',
    title: 'Aerial Score',
    supportLevel: 'derived',
    formula: '0.28*aerialTouches + 0.18*airTime + 0.2*aerialControl + 0.18*airChallengeSuccess + 0.16*contactQuality',
    inputs: ['aerialTouches', 'airTime', 'aerialControl', 'airChallengeSuccess', 'contactQuality'],
    weights: {
      aerialTouches: 0.28,
      airTime: 0.18,
      aerialControl: 0.2,
      airChallengeSuccess: 0.18,
      contactQuality: 0.16
    },
    rationale: 'Rewards repeated useful aerial involvement, not just being airborne.'
  },
  {
    id: 'movementScore',
    title: 'Movement Score',
    supportLevel: 'derived',
    formula: '0.3*averageSpeed + 0.2*pathEfficiency + 0.2*productiveAcceleration + 0.15*recoveries + 0.15*stopPenaltyInverse',
    inputs: ['averageSpeed', 'pathEfficiency', 'productiveAcceleration', 'recoveries', 'stopPenaltyInverse'],
    weights: {
      averageSpeed: 0.3,
      pathEfficiency: 0.2,
      productiveAcceleration: 0.2,
      recoveries: 0.15,
      stopPenaltyInverse: 0.15
    },
    rationale: 'Values speed that translates into useful movement, quick recoveries, and fewer dead stops.'
  },
  {
    id: 'positioningScore',
    title: 'Positioning Score',
    supportLevel: 'inferred',
    formula: '0.24*spacing + 0.22*coverage + 0.18*supportDistance + 0.18*backPostDiscipline + 0.18*roleZoneFit',
    inputs: ['spacing', 'coverage', 'supportDistance', 'backPostDiscipline', 'roleZoneFit'],
    weights: {
      spacing: 0.24,
      coverage: 0.22,
      supportDistance: 0.18,
      backPostDiscipline: 0.18,
      roleZoneFit: 0.18
    },
    rationale: 'Approximates rotational shape and field coverage using only replay state snapshots.'
  },
  {
    id: 'boostManagementScore',
    title: 'Boost Management Score',
    supportLevel: 'derived',
    formula: '0.25*padEfficiency + 0.2*pathing + 0.18*starvationInverse + 0.17*wasteInverse + 0.2*lowValueSpendInverse',
    inputs: ['padEfficiency', 'pathing', 'starvationInverse', 'wasteInverse', 'lowValueSpendInverse'],
    weights: {
      padEfficiency: 0.25,
      pathing: 0.2,
      starvationInverse: 0.18,
      wasteInverse: 0.17,
      lowValueSpendInverse: 0.2
    },
    rationale: 'Rewards efficient pickup routes and reduced waste in low-value moments.'
  },
  {
    id: 'pressureScore',
    title: 'Pressure Score',
    supportLevel: 'inferred',
    formula: '0.25*offensiveControl + 0.2*dangerousTouches + 0.2*shotsCreated + 0.15*finalThirdPresence + 0.2*sustainedAttacks',
    inputs: ['offensiveControl', 'dangerousTouches', 'shotsCreated', 'finalThirdPresence', 'sustainedAttacks'],
    weights: {
      offensiveControl: 0.25,
      dangerousTouches: 0.2,
      shotsCreated: 0.2,
      finalThirdPresence: 0.15,
      sustainedAttacks: 0.2
    },
    rationale: 'Uses possession and territorial proxies to estimate attacking pressure.'
  },
  {
    id: 'recoveryScore',
    title: 'Recovery Score',
    supportLevel: 'inferred',
    formula: '0.24*landingQuality + 0.24*reorientation + 0.22*speedRegain + 0.3*postCommitStability',
    inputs: ['landingQuality', 'reorientation', 'speedRegain', 'postCommitStability'],
    weights: {
      landingQuality: 0.24,
      reorientation: 0.24,
      speedRegain: 0.22,
      postCommitStability: 0.3
    },
    rationale: 'Measures how quickly a player stabilizes after aerials, challenges, or awkward landings.'
  },
  {
    id: 'challengeScore',
    title: 'Challenge Score',
    supportLevel: 'inferred',
    formula: '0.28*timing + 0.28*fiftyQuality + 0.22*defensiveChallengeQuality + 0.22*lowValueCommitInverse',
    inputs: ['timing', 'fiftyQuality', 'defensiveChallengeQuality', 'lowValueCommitInverse'],
    weights: {
      timing: 0.28,
      fiftyQuality: 0.28,
      defensiveChallengeQuality: 0.22,
      lowValueCommitInverse: 0.22
    },
    rationale: 'Approximates challenge quality from touch outcomes and nearby pressure states.'
  },
  {
    id: 'rotationScore',
    title: 'Rotation Score',
    supportLevel: 'inferred',
    formula: '0.24*ordering + 0.24*overcommitInverse + 0.24*backfillTiming + 0.28*thirdManDiscipline',
    inputs: ['ordering', 'overcommitInverse', 'backfillTiming', 'thirdManDiscipline'],
    weights: {
      ordering: 0.24,
      overcommitInverse: 0.24,
      backfillTiming: 0.24,
      thirdManDiscipline: 0.28
    },
    rationale: 'Captures team-shape discipline using relative positions over time.'
  },
  {
    id: 'shootingScore',
    title: 'Shooting Score',
    supportLevel: 'derived',
    formula: '0.26*accuracy + 0.24*shotDanger + 0.26*conversion + 0.24*reboundGeneration',
    inputs: ['accuracy', 'shotDanger', 'conversion', 'reboundGeneration'],
    weights: {
      accuracy: 0.26,
      shotDanger: 0.24,
      conversion: 0.26,
      reboundGeneration: 0.24
    },
    rationale: 'Rewards efficient, dangerous shooting rather than raw volume alone.'
  },
  {
    id: 'defensiveReliabilityScore',
    title: 'Defensive Reliability Score',
    supportLevel: 'derived',
    formula: '0.26*saves + 0.2*clearQuality + 0.18*ownHalfDecisions + 0.2*nearNetChallenges + 0.16*panicTouchInverse',
    inputs: ['saves', 'clearQuality', 'ownHalfDecisions', 'nearNetChallenges', 'panicTouchInverse'],
    weights: {
      saves: 0.26,
      clearQuality: 0.2,
      ownHalfDecisions: 0.18,
      nearNetChallenges: 0.2,
      panicTouchInverse: 0.16
    },
    rationale: 'Looks for stable defensive actions under pressure while penalizing low-quality panic touches.'
  }
];

