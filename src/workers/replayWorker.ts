/// <reference lib="webworker" />

import { parseImportedJson, parseReplayArrayBuffer } from '../lib/parser/replayParser';
import { sha256Hex } from '../lib/utils/hash';
import { createMockReplay } from '../sample-data/mockReplay';
import type { NormalizedReplay } from '../types/replay';
import type { ReplayWorkerRequest, ReplayWorkerResponse } from './messages';

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

const emit = (message: ReplayWorkerResponse) => ctx.postMessage(message);

const parseJsonFile = async (file: File): Promise<NormalizedReplay> => {
  const text = await file.text();
  return parseImportedJson(JSON.parse(text));
};

ctx.onmessage = async (event: MessageEvent<ReplayWorkerRequest>) => {
  try {
    if (event.data.type === 'LOAD_DEMO') {
      emit({ type: 'PROGRESS', progress: 15, message: 'Generating demo replay session' });
      const replay = createMockReplay();
      emit({ type: 'SUCCESS', replay });
      return;
    }

    const { file } = event.data;
    emit({ type: 'PROGRESS', progress: 10, message: `Reading ${file.name}` });

    if (file.name.toLowerCase().endsWith('.json')) {
      emit({ type: 'PROGRESS', progress: 55, message: 'Importing normalized replay JSON' });
      const replay = await parseJsonFile(file);
      emit({ type: 'SUCCESS', replay });
      return;
    }

    const buffer = await file.arrayBuffer();
    emit({ type: 'PROGRESS', progress: 35, message: 'Hashing replay file' });
    const replayHash = await sha256Hex(buffer);
    emit({ type: 'PROGRESS', progress: 60, message: 'Running browser parser adapter' });
    const replay = await parseReplayArrayBuffer({
      fileName: file.name,
      fileSize: file.size,
      buffer
    });

    emit({
      type: 'SUCCESS',
      replay: {
        ...replay,
        replayHash
      }
    });
  } catch (error) {
    emit({
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown worker error'
    });
  }
};

