import type { NormalizedReplay, ReplayMeta, Team } from '../../types/replay';

const formatSessionTime = (recordedAt: string) => {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export const buildReplayTitle = (
  meta: Pick<ReplayMeta, 'finalScore' | 'recordedAt'>,
  teams?: Team[],
  perspectiveTeamId?: string | null,
) => {
  const blueScore = meta.finalScore.blue;
  const orangeScore = meta.finalScore.orange;
  const scoreLabel = `${blueScore}-${orangeScore}`;
  const timeLabel = formatSessionTime(meta.recordedAt);

  let outcome = 'Draw';
  if (blueScore !== orangeScore) {
    if (perspectiveTeamId) {
      const perspectiveWon =
        perspectiveTeamId === 'blue' ? blueScore > orangeScore : orangeScore > blueScore;
      outcome = perspectiveWon ? 'Win' : 'Lose';
    } else if (teams) {
      const winner = blueScore > orangeScore ? teams.find((team) => team.id === 'blue') : teams.find((team) => team.id === 'orange');
      outcome = winner ? `${winner.name} Win` : 'Win';
    } else {
      outcome = 'Win';
    }
  }

  return timeLabel ? `${scoreLabel} ${outcome} ${timeLabel}` : `${scoreLabel} ${outcome}`;
};

export const getReplayTitle = (replay: Pick<NormalizedReplay, 'meta' | 'teams'>) =>
  /\b(Win|Lose|Draw)\b/i.test(replay.meta.title)
    ? replay.meta.title.trim()
    : buildReplayTitle(replay.meta, replay.teams);
