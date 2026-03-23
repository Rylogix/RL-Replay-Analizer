import { getStandoutPlayers } from '../../lib/analytics/selectors';
import { formatMetric } from '../../lib/utils/format';
import type { NormalizedReplay } from '../../types/replay';
import { Panel } from '../../components/Panel';

export const OverviewPanel = ({ replay }: { replay: NormalizedReplay }) => {
  const standout = getStandoutPlayers(replay).slice(0, 3);

  return (
    <div className="tab-grid">
      <Panel title="Match Overview" subtitle="Replay-derived summary">
        <div className="stat-grid">
          <div className="stat-card">
            <span>Score</span>
            <strong>{replay.meta.finalScore.blue} - {replay.meta.finalScore.orange}</strong>
          </div>
          <div className="stat-card">
            <span>Playlist</span>
            <strong>{replay.meta.playlist}</strong>
          </div>
          <div className="stat-card">
            <span>Map</span>
            <strong>{replay.meta.mapName}</strong>
          </div>
        </div>
      </Panel>
      <Panel title="Standout Players" subtitle="Composite of movement, aerial, shooting, and defense">
        <div className="standout-cards">
          {standout.map(({ player, metrics }) => (
            <div key={player.id} className="standout-card">
              <p className="eyebrow">{player.teamId}</p>
              <h3>{player.name}</h3>
              <p>{player.carName}</p>
              <div className="standout-card__stats">
                <span>{metrics.goals} goals</span>
                <span>{metrics.saves} saves</span>
                <span>{formatMetric(metrics.averageSpeed)} uu/s avg</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
};
