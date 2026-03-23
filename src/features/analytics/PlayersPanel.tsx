import { formatMetric, formatPercent } from '../../lib/utils/format';
import type { NormalizedReplay } from '../../types/replay';
import { Panel } from '../../components/Panel';

export const PlayersPanel = ({
  replay
}: {
  replay: NormalizedReplay;
}) => (
  <Panel title="Player Summary" subtitle="Direct stats plus replay-derived movement and boost metrics">
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Goals</th>
            <th>Assists</th>
            <th>Saves</th>
            <th>Shots</th>
            <th>Touches</th>
            <th>Demos</th>
            <th>Avg Speed</th>
            <th>Air Time</th>
            <th>Boost Efficiency</th>
          </tr>
        </thead>
        <tbody>
          {replay.players.map((player) => {
            const metrics = replay.derived.players[player.id];
            return (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{metrics.goals}</td>
                <td>{metrics.assists}</td>
                <td>{metrics.saves}</td>
                <td>{metrics.shots}</td>
                <td>{metrics.touches}</td>
                <td>{metrics.demos}</td>
                <td>{formatMetric(metrics.averageSpeed)}</td>
                <td>{formatMetric(metrics.timeInAir, 1)}s</td>
                <td>{formatPercent(metrics.boostEfficiency, 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Panel>
);
