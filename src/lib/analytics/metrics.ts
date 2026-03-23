import type {
  CarState,
  DerivedPlayerMetrics,
  DerivedTeamMetrics,
  MetricScoreBreakdown,
  NormalizedReplay
} from '../../types/replay';
import { normalize01, weightedAverage, magnitude } from '../utils/math';
import { metricFormulaDefinitions } from './formulas';

const scoreBreakdown = (
  label: string,
  rationale: string,
  components: Record<string, number>,
): MetricScoreBreakdown => ({
  label,
  rationale,
  components,
  total: Math.round((Object.values(components).reduce((sum, value) => sum + value, 0) / Object.keys(components).length) * 100)
});

const carFramesForPlayer = (replay: NormalizedReplay, playerId: string): Array<{ time: number; car: CarState }> =>
  replay.frames.flatMap((frame) => {
    const car = frame.cars.find((entry) => entry.playerId === playerId);
    return car ? [{ time: frame.time, car }] : [];
  });

const estimateBoostSpent = (frames: Array<{ time: number; car: CarState }>) => {
  let spent = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1].car.boost;
    const current = frames[index].car.boost;
    if (current < previous) {
      spent += previous - current;
    }
  }
  return spent;
};

const buildPlayerMetrics = (replay: NormalizedReplay, playerId: string): DerivedPlayerMetrics => {
  const player = replay.players.find((entry) => entry.id === playerId)!;
  const playerFrames = carFramesForPlayer(replay, playerId);
  const touches = replay.touches.filter((entry) => entry.playerId === playerId);
  const goals = replay.goals.filter((entry) => entry.scorerId === playerId);
  const assists = replay.goals.filter((entry) => entry.assistId === playerId);
  const saves = replay.saves.filter((entry) => entry.playerId === playerId);
  const shots = replay.shots.filter((entry) => entry.shooterId === playerId);
  const demos = replay.demos.filter((entry) => entry.attackerId === playerId);
  const boostPickups = replay.boostPickups.filter((entry) => entry.playerId === playerId);
  const possessions = replay.possessions.filter((entry) => entry.playerId === playerId || entry.teamId === player.teamId);
  const pressureWindows = replay.pressureWindows.filter((entry) => entry.teamId === player.teamId);

  const speeds = playerFrames.map((entry) => magnitude(entry.car.velocity));
  const averageSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / Math.max(1, speeds.length);
  const maxSpeed = Math.max(0, ...speeds);
  const timeInAir = playerFrames.reduce((sum, entry, index) => {
    if (!index || !entry.car.airborne) {
      return sum;
    }

    return sum + (entry.time - playerFrames[index - 1].time);
  }, 0);
  const timeSupersonic = playerFrames.reduce((sum, entry, index) => {
    if (!index || !entry.car.supersonic) {
      return sum;
    }

    return sum + (entry.time - playerFrames[index - 1].time);
  }, 0);

  const boostCollected = boostPickups.reduce((sum, entry) => sum + entry.amount, 0);
  const boostSpentEstimate = estimateBoostSpent(playerFrames);
  const boostEfficiency = boostCollected / Math.max(boostCollected + boostSpentEstimate, 1);

  const aerialTouchesNorm = normalize01(touches.filter((entry) => entry.aerial).length, 25);
  const airTimeNorm = normalize01(timeInAir, replay.meta.durationSeconds * 0.35);
  const avgTouchHeight =
    touches.reduce((sum, entry) => sum + entry.height, 0) / Math.max(1, touches.length);
  const aerialControl = normalize01(avgTouchHeight, 800);
  const airChallengeSuccess = normalize01(
    touches.filter((entry) => entry.aerial && entry.speed > 1200).length,
    20,
  );
  const contactQuality = normalize01(
    touches.reduce((sum, entry) => sum + entry.speed, 0) / Math.max(1, touches.length),
    2500,
  );

  const pathEfficiency = normalize01(averageSpeed / Math.max(maxSpeed, 1), 0.9);
  const productiveAcceleration = normalize01(
    playerFrames.filter((entry) => magnitude(entry.car.velocity) > 1400).length,
    playerFrames.length * 0.7,
  );
  const recoveries = normalize01(playerFrames.filter((entry) => !entry.car.airborne).length, playerFrames.length);
  const unnecessaryStops = normalize01(
    playerFrames.filter((entry) => magnitude(entry.car.velocity) < 150).length,
    playerFrames.length * 0.4,
  );

  const spacing = normalize01(
    playerFrames.reduce((sum, entry) => sum + Math.abs(entry.car.position.x), 0) / Math.max(1, playerFrames.length),
    2500,
  );
  const coverage = normalize01(
    playerFrames.reduce((sum, entry) => sum + Math.abs(entry.car.position.y), 0) / Math.max(1, playerFrames.length),
    3500,
  );
  const supportDistance = normalize01(possessions.length, 20);
  const backPostDiscipline = normalize01(saves.length + replay.goals.filter((entry) => entry.teamId !== player.teamId).length, 10);
  const roleZoneFit = normalize01(pressureWindows.length + possessions.length, 25);

  const padEfficiency = normalize01(boostCollected / Math.max(boostPickups.length, 1), 100);
  const boostPathing = normalize01(boostPickups.filter((entry) => !entry.isLarge).length, Math.max(boostPickups.length, 1));
  const starvationInverse = 1 - normalize01(playerFrames.filter((entry) => entry.car.boost < 20).length, playerFrames.length * 0.45);
  const wasteInverse = 1 - normalize01(boostSpentEstimate, 1800);
  const lowValueSpendInverse = 1 - normalize01(
    playerFrames.filter((entry) => entry.car.boost > 70 && magnitude(entry.car.velocity) < 600).length,
    playerFrames.length * 0.25,
  );

  const offensiveControl = normalize01(possessions.filter((entry) => entry.teamId === player.teamId).length, 25);
  const dangerousTouches = normalize01(
    touches.filter((entry) => Math.abs(entry.position.y) > 3200).length,
    20,
  );
  const shotsCreated = normalize01(shots.length, 10);
  const finalThirdPresence = normalize01(
    playerFrames.filter((entry) =>
      player.teamId === 'orange' ? entry.car.position.y < -2500 : entry.car.position.y > 2500,
    ).length,
    playerFrames.length * 0.45,
  );
  const sustainedAttacks = normalize01(pressureWindows.length, 10);

  const landingQuality = normalize01(
    playerFrames.filter((entry) => !entry.car.airborne && Math.abs(entry.car.rotation.z) < 1.2).length,
    playerFrames.length,
  );
  const reorientation = normalize01(
    playerFrames.filter((entry) => Math.abs(entry.car.rotation.y) < 1.6).length,
    playerFrames.length,
  );
  const speedRegain = normalize01(
    playerFrames.filter((entry) => !entry.car.airborne && magnitude(entry.car.velocity) > 1200).length,
    playerFrames.length * 0.7,
  );
  const postCommitStability = normalize01(recoveries, 1);

  const timing = normalize01(touches.length / Math.max(shots.length + saves.length, 1), 4);
  const fiftyQuality = normalize01(replay.bumps.filter((entry) => entry.attackerId === playerId).length, 8);
  const defensiveChallengeQuality = normalize01(
    saves.length + replay.demos.filter((entry) => entry.teamId !== player.teamId).length,
    10,
  );
  const lowValueCommitInverse = 1 - normalize01(demos.length, 8);

  const ordering = normalize01(possessions.length, 20);
  const overcommitInverse = 1 - normalize01(
    replay.goals.filter((entry) => entry.teamId !== player.teamId).length,
    6,
  );
  const backfillTiming = normalize01(saves.length + pressureWindows.length, 15);
  const thirdManDiscipline = normalize01(coverage + spacing, 2);

  const accuracy = normalize01(shots.filter((entry) => entry.onTarget).length, Math.max(shots.length, 1));
  const shotDanger = normalize01(
    shots.reduce((sum, entry) => sum + entry.danger, 0) / Math.max(1, shots.length),
    1,
  );
  const conversion = normalize01(goals.length, Math.max(shots.length, 1));
  const reboundGeneration = normalize01(touches.filter((entry) => entry.speed > 1500).length, 25);

  const saveQuality = normalize01(
    saves.reduce((sum, entry) => sum + entry.quality, 0) / Math.max(1, saves.length),
    1,
  );
  const clearQuality = normalize01(
    touches.filter((entry) => Math.abs(entry.position.y) > 2500 && entry.speed > 1200).length,
    20,
  );
  const ownHalfDecisions = normalize01(
    playerFrames.filter((entry) =>
      player.teamId === 'blue' ? entry.car.position.y < 0 : entry.car.position.y > 0,
    ).length,
    playerFrames.length,
  );
  const nearNetChallenges = normalize01(
    saves.length + replay.demos.filter((entry) => entry.victimId === playerId).length,
    8,
  );
  const panicTouchInverse = 1 - normalize01(
    touches.filter((entry) => Math.abs(entry.position.y) > 4200 && entry.speed < 800).length,
    10,
  );

  return {
    playerId,
    teamId: player.teamId,
    goals: goals.length,
    assists: assists.length,
    saves: saves.length,
    shots: shots.length,
    touches: touches.length,
    demos: demos.length,
    averageSpeed,
    maxSpeed,
    timeInAir,
    timeSupersonic,
    boostCollected,
    boostSpentEstimate,
    boostEfficiency,
    aerialScore: scoreBreakdown('Aerial Score', metricFormulaDefinitions.find((entry) => entry.id === 'aerialScore')!.rationale, {
      aerialTouches: aerialTouchesNorm,
      airTime: airTimeNorm,
      aerialControl,
      airChallengeSuccess,
      contactQuality
    }),
    movementScore: scoreBreakdown('Movement Score', metricFormulaDefinitions.find((entry) => entry.id === 'movementScore')!.rationale, {
      averageSpeed: normalize01(averageSpeed, 1900),
      pathEfficiency,
      productiveAcceleration,
      recoveries,
      stopPenaltyInverse: 1 - unnecessaryStops
    }),
    positioningScore: scoreBreakdown('Positioning Score', metricFormulaDefinitions.find((entry) => entry.id === 'positioningScore')!.rationale, {
      spacing,
      coverage,
      supportDistance,
      backPostDiscipline,
      roleZoneFit
    }),
    boostManagementScore: scoreBreakdown('Boost Management Score', metricFormulaDefinitions.find((entry) => entry.id === 'boostManagementScore')!.rationale, {
      padEfficiency,
      pathing: boostPathing,
      starvationInverse,
      wasteInverse,
      lowValueSpendInverse
    }),
    pressureScore: scoreBreakdown('Pressure Score', metricFormulaDefinitions.find((entry) => entry.id === 'pressureScore')!.rationale, {
      offensiveControl,
      dangerousTouches,
      shotsCreated,
      finalThirdPresence,
      sustainedAttacks
    }),
    recoveryScore: scoreBreakdown('Recovery Score', metricFormulaDefinitions.find((entry) => entry.id === 'recoveryScore')!.rationale, {
      landingQuality,
      reorientation,
      speedRegain,
      postCommitStability
    }),
    challengeScore: scoreBreakdown('Challenge Score', metricFormulaDefinitions.find((entry) => entry.id === 'challengeScore')!.rationale, {
      timing,
      fiftyQuality,
      defensiveChallengeQuality,
      lowValueCommitInverse
    }),
    rotationScore: scoreBreakdown('Rotation Score', metricFormulaDefinitions.find((entry) => entry.id === 'rotationScore')!.rationale, {
      ordering,
      overcommitInverse,
      backfillTiming,
      thirdManDiscipline
    }),
    shootingScore: scoreBreakdown('Shooting Score', metricFormulaDefinitions.find((entry) => entry.id === 'shootingScore')!.rationale, {
      accuracy,
      shotDanger,
      conversion,
      reboundGeneration
    }),
    defensiveReliabilityScore: scoreBreakdown('Defensive Reliability Score', metricFormulaDefinitions.find((entry) => entry.id === 'defensiveReliabilityScore')!.rationale, {
      saves: saveQuality,
      clearQuality,
      ownHalfDecisions,
      nearNetChallenges,
      panicTouchInverse
    })
  };
};

export const computeReplayAnalytics = (
  replay: NormalizedReplay,
): { players: Record<string, DerivedPlayerMetrics>; teams: Record<string, DerivedTeamMetrics>; formulas: typeof metricFormulaDefinitions } => {
  const playerMetrics = Object.fromEntries(
    replay.players.map((player) => [player.id, buildPlayerMetrics(replay, player.id)]),
  );

  const teamMetrics = Object.fromEntries(
    replay.teams.map((team) => {
      const teamPlayers = team.playerIds.map((playerId) => playerMetrics[playerId]).filter(Boolean);
      const possessionTime = replay.possessions
        .filter((segment) => segment.teamId === team.id)
        .reduce((sum, segment) => sum + (segment.endTime - segment.startTime), 0);
      const offensiveHalfRatio =
        replay.frames.filter((frame) =>
          team.id === 'blue' ? frame.ball.position.y > 0 : frame.ball.position.y < 0,
        ).length / Math.max(1, replay.frames.length);
      const shots = replay.shots.filter((entry) => entry.teamId === team.id).length;
      const goals = replay.goals.filter((entry) => entry.teamId === team.id).length;
      const saves = replay.saves.filter((entry) => entry.teamId === team.id).length;
      const demos = replay.demos.filter((entry) => entry.teamId === team.id).length;

      const pressureScore = weightedAverage(
        teamPlayers.map((entry) => ({ value: entry.pressureScore.total / 100, weight: 1 })),
      );

      return [
        team.id,
        {
          teamId: team.id,
          possessionTime,
          offensiveHalfRatio,
          shots,
          goals,
          saves,
          demos,
          pressureScore: {
            label: 'Team Pressure Score',
            rationale: 'Average of player pressure scores plus offensive-half control.',
            components: {
              players: pressureScore,
              territory: offensiveHalfRatio
            },
            total: Math.round(((pressureScore + offensiveHalfRatio) / 2) * 100)
          }
        } satisfies DerivedTeamMetrics
      ];
    }),
  );

  return {
    players: playerMetrics,
    teams: teamMetrics,
    formulas: metricFormulaDefinitions
  };
};

