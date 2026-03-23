import { openDB } from 'idb';
import type { NormalizedReplay } from '../../types/replay';
import { getReplayTitle } from '../utils/replayTitle';

const DB_NAME = 'replayforge-db';
const STORE_NAME = 'sessions';

export interface StoredReplaySession {
  replayHash: string;
  title: string;
  updatedAt: string;
  replay: NormalizedReplay;
}

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(database) {
    const store = database.createObjectStore(STORE_NAME, { keyPath: 'replayHash' });
    store.createIndex('updatedAt', 'updatedAt');
  }
});

export const replayDb = {
  async save(replay: NormalizedReplay) {
    const db = await dbPromise;
    const record: StoredReplaySession = {
      replayHash: replay.replayHash,
      title: getReplayTitle(replay),
      updatedAt: new Date().toISOString(),
      replay
    };
    await db.put(STORE_NAME, record);
  },
  async list() {
    const db = await dbPromise;
    return db.getAllFromIndex(STORE_NAME, 'updatedAt');
  },
  async get(replayHash: string) {
    const db = await dbPromise;
    return db.get(STORE_NAME, replayHash);
  },
  async remove(replayHash: string) {
    const db = await dbPromise;
    return db.delete(STORE_NAME, replayHash);
  }
};
