import { useMemo } from 'react';
import { formatClock } from '../lib/utils/format';
import type { NormalizedReplay } from '../types/replay';
import { Panel } from './Panel';
import { SupportBadge } from './SupportBadge';

interface EventFeedProps {
  replay: NormalizedReplay;
  currentTime: number;
  onSeek: (time: number) => void;
}

export const EventFeed = ({ replay, currentTime, onSeek }: EventFeedProps) => {
  const events = useMemo(
    () =>
      replay.timeline
        .filter((event) => Math.abs(event.time - currentTime) <= 45)
        .sort((left, right) => Math.abs(left.time - currentTime) - Math.abs(right.time - currentTime))
        .slice(0, 12),
    [currentTime, replay.timeline],
  );

  return (
    <Panel title="Event Feed" subtitle="Synchronized chronological events" className="event-feed">
      <div className="event-feed__list">
        {events.map((event) => (
          <button key={event.id} type="button" className="event-feed__item" onClick={() => onSeek(event.time)}>
            <div className="event-feed__item-row">
              <strong>{event.title}</strong>
              <span>{formatClock(event.time)}</span>
            </div>
            <p>{event.description}</p>
            <SupportBadge level={event.supportLevel} />
          </button>
        ))}
      </div>
    </Panel>
  );
};

