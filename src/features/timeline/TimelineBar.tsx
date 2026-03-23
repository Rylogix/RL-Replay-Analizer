import { formatClock } from '../../lib/utils/format';
import { Panel } from '../../components/Panel';
import type { NormalizedReplay, ReplayEventType } from '../../types/replay';

const timelineFilterTypes: ReplayEventType[] = ['goal', 'shot', 'save', 'demo', 'bump', 'kickoff'];

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
  aerial: '#95f6ff',
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
  onToggleFilter,
}: TimelineBarProps) => {
  const visibleEvents = replay.timeline.filter(
    (event) => timelineFilterTypes.includes(event.type) && filters[event.type],
  );
  const duration = replay.meta.durationSeconds;
  const scrubberProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Panel title="Timeline" subtitle="Scrub, filter, cluster, and jump between replay events" className="timeline-panel">
      <div className="timeline-panel__scrubber">
        <input
          className="slider slider--timeline"
          style={{ ['--range-progress' as string]: `${scrubberProgress}%` }}
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
        <div className="timeline-panel__rail">
          <div className="timeline-panel__rail-fill" style={{ width: `${scrubberProgress}%` }} />
        </div>
        <div className="timeline-panel__cursor" style={{ left: `${scrubberProgress}%` }} />
        {visibleEvents.map((event, index) => (
          <button
            key={event.id}
            type="button"
            className="timeline-panel__marker"
            title={`${event.title} • ${event.description}`}
            style={{
              left: `${(event.time / duration) * 100}%`,
              backgroundColor: markerColor[event.type],
              top: `${12 + (index % 3) * 14}px`,
              width: `${10 + event.importance * 8}px`,
              height: `${10 + event.importance * 8}px`,
              boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 0 18px ${markerColor[event.type]}55`,
            }}
            onClick={() => onSeek(event.time)}
          />
        ))}
      </div>

      <div className="timeline-panel__filters">
        {timelineFilterTypes.map((eventType) => (
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
