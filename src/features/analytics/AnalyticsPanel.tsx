import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SupportBadge } from '../../components/SupportBadge';
import { Panel } from '../../components/Panel';
import { formatMetric } from '../../lib/utils/format';
import type { NormalizedReplay } from '../../types/replay';

export const AnalyticsPanel = ({
  replay,
  selectedPlayerId
}: {
  replay: NormalizedReplay;
  selectedPlayerId: string | null;
}) => {
  const player = replay.players.find((entry) => entry.id === selectedPlayerId) ?? replay.players[0];
  const metrics = replay.derived.players[player.id];
  const chartData = [
    { key: 'Aerial', value: metrics.aerialScore.total },
    { key: 'Movement', value: metrics.movementScore.total },
    { key: 'Positioning', value: metrics.positioningScore.total },
    { key: 'Boost', value: metrics.boostManagementScore.total },
    { key: 'Pressure', value: metrics.pressureScore.total },
    { key: 'Recovery', value: metrics.recoveryScore.total },
    { key: 'Challenge', value: metrics.challengeScore.total },
    { key: 'Rotation', value: metrics.rotationScore.total },
    { key: 'Shooting', value: metrics.shootingScore.total },
    { key: 'Defense', value: metrics.defensiveReliabilityScore.total }
  ];

  return (
    <div className="tab-grid tab-grid--analytics">
      <Panel title="Advanced Analytics" subtitle={`Custom replay-derived metrics for ${player.name}`}>
        <div className="chart-shell">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="key" tick={{ fill: '#a9bfcb', fontSize: 12 }} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fill: '#a9bfcb' }} domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={entry.key} fill={index % 2 === 0 ? '#31c4bf' : '#ff9c53'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Formula Transparency" subtitle="Each metric is explicitly labeled as custom and replay-derived">
        <div className="formula-grid">
          {replay.derived.formulas.map((formula) => (
            <article key={formula.id} className="formula-card">
              <div className="formula-card__header">
                <h3>{formula.title}</h3>
                <SupportBadge level={formula.supportLevel} />
              </div>
              <code>{formula.formula}</code>
              <p>{formula.rationale}</p>
              <p className="muted">{formula.inputs.join(' • ')}</p>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="Selected Player Breakdown" subtitle={`${player.name} custom score details`}>
        <div className="metric-breakdown">
          {([
            metrics.aerialScore,
            metrics.movementScore,
            metrics.positioningScore,
            metrics.boostManagementScore,
            metrics.pressureScore,
            metrics.recoveryScore,
            metrics.challengeScore,
            metrics.rotationScore,
            metrics.shootingScore,
            metrics.defensiveReliabilityScore
          ]).map((score) => (
            <div key={score.label} className="metric-breakdown__row">
              <div>
                <strong>{score.label}</strong>
                <p>{score.rationale}</p>
              </div>
              <span>{formatMetric(score.total)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};

