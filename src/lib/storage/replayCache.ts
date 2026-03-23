import type { NormalizedReplay } from '../../types/replay';
import { replayDb } from './db';

export const cacheReplaySession = async (replay: NormalizedReplay) => {
  await replayDb.save(replay);
};

export const listCachedSessions = async () => {
  const sessions = await replayDb.list();
  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

export const exportReplaySession = (replay: NormalizedReplay) => {
  const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${replay.meta.title.replace(/\s+/g, '-').toLowerCase()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

