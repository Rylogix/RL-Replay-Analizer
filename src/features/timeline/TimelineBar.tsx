import { formatClock } from '../../lib/utils/format';
import { Panel } from '../../components/Panel';
import type { NormalizedReplay, ReplayEventType } from '../../types/replay';

const markerColor: Record<ReplayEventType, string> = {
  goal: '#ffe082',
  shot: '#91f2de',
  save: '#74b8ff',
  demo: '#ff5f5f',
  bump: '#d8c3ff',
  boost: '#b9ff8e',
  touch: '#59dbe9',
  kickoff: '#ffffff',
  possession: '#7ed6ff',
  pressure: '#ffb36a',
  aerial: '#95f6ff'
};

interface TimelineBarProps {
  replay: NormalizedReplay;
  currentTime: number;
  filters: Record<ReplayEventType, boolean>;
  onSeek: (time: number) => void;
  onToggleFilter: (eventType: ReplayEventType) => void;
}

export const TimelineBar = ({
  replay,
  currentTime,
  filters,
  onSeek,
  onToggleFilter
}: TimelineBarProps) => {
  const visibleEvents = replay.timeline.filter((event) => filters[event.type]);
  const duration = replay.meta.durationSeconds;

  return (
    <Panel title="Timeline" subtitle="Scrub, filter, cluster, and jump between replay events" className="timeline-panel">
      <div className="timeline-panel__scrubber">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={currentTime}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <div className="timeline-panel__axis">
          <span>0:00</span>
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>
      <div className="timeline-panel__markers">
        <div className="timeline-panel__rail" />
        <div className="timeline-panel__cursor" style={{ left: `${(currentTime / duration) * 100}%` }} />
        {visibleEvents.map((event, index) => (
          <button
            key={event.id}
            type="button"
            className="timeline-panel__marker"
            title={`${event.title} • ${event.description}`}
            style={{
              left: `${(event.time / duration) * 100}%`,
              backgroundColor: markerColor[event.type],
              top: `${12 + (index % 3) * 14}px`
            }}
            onClick={() => onSeek(event.time)}
          />
        ))}
      </div>
      <div className="timeline-panel__filters">
        {(Object.keys(filters) as ReplayEventType[]).map((eventType) => (
          <button
            key={eventType}
            type="button"
            className={`chip ${filters[eventType] ? 'chip--active' : ''}`}
            onClick={() => onToggleFilter(eventType)}
          >
            <span className="timeline-panel__swatch" style={{ backgroundColor: markerColor[eventType] }} />
            {eventType}
          </button>
        ))}
      </div>
      <p className="muted">Keyboard shortcuts: `Space` play/pause, `←/→` step 1 second, `Shift+←/→` step 5 seconds, `[` and `]` change speed.</p>
    </Panel>
  );
};

