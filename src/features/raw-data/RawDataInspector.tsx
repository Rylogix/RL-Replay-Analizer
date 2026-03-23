import { useMemo } from 'react';
import { summarizeSupport } from '../../lib/parser/featureSupport';
import type { NormalizedReplay } from '../../types/replay';
import { Panel } from '../../components/Panel';
import { SupportBadge } from '../../components/SupportBadge';

export const RawDataInspector = ({ replay }: { replay: NormalizedReplay }) => {
  const serialized = useMemo(() => JSON.stringify(replay, null, 2), [replay]);

  return (
    <div className="tab-grid">
      <Panel title="Feature Support Matrix" subtitle="Every advanced metric or event is labeled explicitly">
        <div className="support-grid">
          {summarizeSupport(replay).map(([key, level]) => (
            <div key={key} className="support-grid__row">
              <code>{key}</code>
              <SupportBadge level={level} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Raw Data Inspector" subtitle="Normalized JSON for local debugging, export, and parser validation">
        <pre className="raw-json">{serialized}</pre>
      </Panel>
    </div>
  );
};

