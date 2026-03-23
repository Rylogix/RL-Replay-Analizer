import type { NormalizedReplay } from '../../types/replay';
import type { ReplayWorkerRequest, ReplayWorkerResponse } from '../../workers/messages';

class ReplayWorkerClient {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(new URL('../../workers/replayWorker.ts', import.meta.url), {
      type: 'module'
    });
  }

  run(
    request: ReplayWorkerRequest,
    onProgress?: (progress: number, message: string) => void,
  ): Promise<NormalizedReplay> {
    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<ReplayWorkerResponse>) => {
        const message = event.data;
        if (message.type === 'PROGRESS') {
          onProgress?.(message.progress, message.message);
          return;
        }

        this.worker.removeEventListener('message', handleMessage);
        if (message.type === 'SUCCESS') {
          resolve(message.replay);
          return;
        }

        reject(new Error(message.error));
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage(request);
    });
  }
}

let client: ReplayWorkerClient | null = null;

export const getReplayWorkerClient = () => {
  if (!client) {
    client = new ReplayWorkerClient();
  }

  return client;
};

