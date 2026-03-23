import { create } from 'zustand';
import { getReplayWorkerClient } from '../lib/parser/replayWorkerClient';
import { listCachedSessions, cacheReplaySession, exportReplaySession } from '../lib/storage/replayCache';
import { replayDb, type StoredReplaySession } from '../lib/storage/db';
import type { CameraMode, NormalizedReplay, ReplayEventType } from '../types/replay';

export type AppTab = 'overview' | 'players' | 'analytics';

const defaultEventFilters: Record<ReplayEventType, boolean> = {
  goal: true,
  shot: true,
  save: true,
  demo: true,
  bump: true,
  boost: true,
  touch: true,
  kickoff: true,
  possession: true,
  pressure: true,
  aerial: true
};

interface ReplayForgeState {
  replay: NormalizedReplay | null;
  sessions: StoredReplaySession[];
  selectedTab: AppTab;
  selectedPlayerId: string | null;
  cameraMode: CameraMode;
  currentTime: number;
  isPlaying: boolean;
  playbackSpeed: number;
  loading: boolean;
  parseProgress: number;
  parseMessage: string;
  error: string | null;
  eventFilters: Record<ReplayEventType, boolean>;
  hydrateSessions: () => Promise<void>;
  parseFile: (file: File) => Promise<void>;
  openSession: (replayHash: string) => Promise<void>;
  deleteSession: (replayHash: string) => Promise<void>;
  exportCurrentReplay: () => void;
  setReplay: (replay: NormalizedReplay) => void;
  seek: (time: number) => void;
  step: (delta: number) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setSelectedTab: (tab: AppTab) => void;
  setSelectedPlayerId: (playerId: string | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setError: (error: string | null) => void;
  setEventFilter: (eventType: ReplayEventType) => void;
}

const applyReplay = (replay: NormalizedReplay, set: (state: Partial<ReplayForgeState>) => void) => {
  set({
    replay,
    currentTime: 0,
    isPlaying: false,
    selectedPlayerId: replay.players[0]?.id ?? null,
    parseProgress: 100,
    parseMessage: 'Replay ready',
    loading: false,
    error: null
  });
};

export const useReplayForgeStore = create<ReplayForgeState>((set, get) => ({
  replay: null,
  sessions: [],
  selectedTab: 'overview',
  selectedPlayerId: null,
  cameraMode: 'followBall',
  currentTime: 0,
  isPlaying: false,
  playbackSpeed: 1,
  loading: false,
  parseProgress: 0,
  parseMessage: 'Idle',
  error: null,
  eventFilters: defaultEventFilters,
  hydrateSessions: async () => {
    const sessions = await listCachedSessions();
    set({ sessions });
  },
  parseFile: async (file) => {
    set({ loading: true, parseProgress: 0, parseMessage: `Parsing ${file.name}`, error: null });
    try {
      const replay = await getReplayWorkerClient().run(
        { type: 'PARSE_FILE', file },
        (progress, message) => set({ parseProgress: progress, parseMessage: message }),
      );
      await cacheReplaySession(replay);
      const sessions = await listCachedSessions();
      applyReplay(replay, set);
      set({ sessions });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to parse replay file'
      });
    }
  },
  openSession: async (replayHash) => {
    const session = await replayDb.get(replayHash);
    if (!session?.replay) {
      set({ error: `Replay session ${replayHash} was not found in IndexedDB.` });
      return;
    }
    applyReplay(session.replay, set);
  },
  deleteSession: async (replayHash) => {
    await replayDb.remove(replayHash);
    const sessions = await listCachedSessions();
    const currentReplay = get().replay;
    set({
      sessions,
      replay: currentReplay?.replayHash === replayHash ? null : currentReplay
    });
  },
  exportCurrentReplay: () => {
    const replay = get().replay;
    if (replay) {
      exportReplaySession(replay);
    }
  },
  setReplay: (replay) => applyReplay(replay, set),
  seek: (time) => {
    const replay = get().replay;
    if (!replay) {
      return;
    }
    set({ currentTime: Math.max(0, Math.min(time, replay.meta.durationSeconds)) });
  },
  step: (delta) => {
    const replay = get().replay;
    if (!replay) {
      return;
    }
    set({
      currentTime: Math.max(0, Math.min(get().currentTime + delta, replay.meta.durationSeconds))
    });
  },
  togglePlayback: () => set({ isPlaying: !get().isPlaying }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  setSelectedPlayerId: (playerId) => set({ selectedPlayerId: playerId }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setError: (error) => set({ error }),
  setEventFilter: (eventType) =>
    set({
      eventFilters: {
        ...get().eventFilters,
        [eventType]: !get().eventFilters[eventType]
      }
    })
}));
