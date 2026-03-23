import type { CSSProperties } from 'react';
import { SupportBadge } from '../../components/SupportBadge';
import { Panel } from '../../components/Panel';
import { formatMetric } from '../../lib/utils/format';
import type { MetricScoreBreakdown, NormalizedReplay } from '../../types/replay';

const toCards = (replay: NormalizedReplay, selectedPlayerId: string | null) => {
  const player = replay.players.find((entry) => entry.id === selectedPlayerId) ?? replay.players[0];
  const metrics = replay.derived.players[player.id];

  const cards: MetricScoreBreakdown[] = [
    metrics.aerialScore,
    metrics.movementScore,
    metrics.positioningScore,
    metrics.boostManagementScore,
    metrics.pressureScore,
    metrics.recoveryScore,
    metrics.challengeScore,
    metrics.rotationScore,
    metrics.shootingScore,
    metrics.defensiveReliabilityScore,
  ];

  return { player, cards };
};

export const AnalyticsPanel = ({
  replay,
  selectedPlayerId,
}: {
  replay: NormalizedReplay;
  selectedPlayerId: string | null;
}) => {
  const { player, cards } = toCards(replay, selectedPlayerId);

  return (
    <Panel title="Advanced Analytics" subtitle={`Compact replay-derived scoring for ${player.name}`}>
      <p className="muted analytics-summary">
        These are custom replay-derived metrics, not official Rocket League stats. Scores are shown as a compact
        systems-style progress panel.
      </p>
      <div className="progress-stat-list">
        {cards.map((score, index) => (
          <article
            key={score.label}
            className="progress-stat"
            style={
              {
                '--progress-value': `${score.total}%`,
                '--progress-fill':
                  index % 3 === 0
                    ? 'var(--accent-green)'
                    : index % 3 === 1
                      ? 'var(--accent-blue)'
                      : 'var(--accent-purple)',
              } as CSSProperties
            }
          >
            <div className="progress-stat__main">
              <div className="progress-stat__label">
                <strong>{score.label}</strong>
                <div className="progress-stat__meta">
                  <SupportBadge level={replay.derived.formulas[index]?.supportLevel ?? 'derived'} />
                  <span>{score.rationale}</span>
                </div>
              </div>
              <div className="progress-stat__track" aria-hidden="true">
                <div className="progress-stat__fill" />
              </div>
              <strong className="progress-stat__value">{formatMetric(score.total)}</strong>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
};
