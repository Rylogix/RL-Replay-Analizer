import type { NormalizedReplay, TimelineEvent } from '../../types/replay';

export const buildTimelineEvents = (replay: NormalizedReplay): TimelineEvent[] => {
  const kickoffEvents: TimelineEvent[] = [
    {
      id: 'kickoff-0',
      type: 'kickoff',
      time: 0,
      title: 'Kickoff',
      description: 'Match start',
      importance: 0.75,
      supportLevel: replay.support['events.kickoffs'] ?? 'derived'
    }
  ];

  const goals = replay.goals.map<TimelineEvent>((goal) => ({
    id: goal.id,
    type: 'goal',
    time: goal.time,
    title: 'Goal',
    description: `${replay.players.find((entry) => entry.id === goal.scorerId)?.name ?? 'Unknown'} scored`,
    playerId: goal.scorerId,
    teamId: goal.teamId,
    importance: 1,
    supportLevel: replay.support['events.goals'] ?? 'direct'
  }));

  const shots = replay.shots.map<TimelineEvent>((shot) => ({
    id: shot.id,
    type: 'shot',
    time: shot.time,
    title: 'Shot',
    description: `${replay.players.find((entry) => entry.id === shot.shooterId)?.name ?? 'Unknown'} took a shot`,
    playerId: shot.shooterId,
    teamId: shot.teamId,
    importance: 0.72,
    supportLevel: replay.support['events.shots'] ?? 'direct'
  }));

  const saves = replay.saves.map<TimelineEvent>((save) => ({
    id: save.id,
    type: 'save',
    time: save.time,
    title: 'Save',
    description: `${replay.players.find((entry) => entry.id === save.playerId)?.name ?? 'Unknown'} made a save`,
    playerId: save.playerId,
    teamId: save.teamId,
    importance: 0.78,
    supportLevel: replay.support['events.saves'] ?? 'direct'
  }));

  const demos = replay.demos.map<TimelineEvent>((demo) => ({
    id: demo.id,
    type: 'demo',
    time: demo.time,
    title: 'Demolition',
    description: `${replay.players.find((entry) => entry.id === demo.attackerId)?.name ?? 'Unknown'} demoed ${replay.players.find((entry) => entry.id === demo.victimId)?.name ?? 'Unknown'}`,
    playerId: demo.attackerId,
    teamId: demo.teamId,
    importance: 0.85,
    supportLevel: replay.support['events.demos'] ?? 'inferred'
  }));

  const bumps = replay.bumps.map<TimelineEvent>((bump) => ({
    id: bump.id,
    type: 'bump',
    time: bump.time,
    title: 'Bump',
    description: `${replay.players.find((entry) => entry.id === bump.attackerId)?.name ?? 'Unknown'} bumped ${replay.players.find((entry) => entry.id === bump.victimId)?.name ?? 'Unknown'}`,
    playerId: bump.attackerId,
    teamId: bump.teamId,
    importance: 0.5,
    supportLevel: replay.support['events.bumps'] ?? 'inferred'
  }));

  const boosts = replay.boostPickups.map<TimelineEvent>((pickup) => ({
    id: pickup.id,
    type: 'boost',
    time: pickup.time,
    title: 'Boost Pickup',
    description: `${replay.players.find((entry) => entry.id === pickup.playerId)?.name ?? 'Unknown'} collected ${pickup.isLarge ? 'full' : 'small'} boost`,
    playerId: pickup.playerId,
    teamId: pickup.teamId,
    importance: pickup.isLarge ? 0.55 : 0.35,
    supportLevel: replay.support['events.boostPickups'] ?? 'inferred'
  }));

  return [...kickoffEvents, ...goals, ...shots, ...saves, ...demos, ...bumps, ...boosts].sort(
    (left, right) => left.time - right.time,
  );
};
