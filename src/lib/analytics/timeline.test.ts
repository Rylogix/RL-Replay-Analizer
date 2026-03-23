import { buildTimelineEvents } from './timeline';
import { createMockReplay } from '../../sample-data/mockReplay';

describe('buildTimelineEvents', () => {
  it('builds a sorted event list with kickoff and key replay events', () => {
    const replay = createMockReplay();
    const events = buildTimelineEvents(replay);

    expect(events[0].type).toBe('kickoff');
    expect(events.some((event) => event.type === 'goal')).toBe(true);
    expect(events.some((event) => event.type === 'shot')).toBe(true);
    expect(events.some((event) => event.type === 'save')).toBe(true);
    expect(events.some((event) => event.type === 'demo')).toBe(true);
    expect(events.every((event, index) => index === 0 || events[index - 1].time <= event.time)).toBe(true);
  });
});
