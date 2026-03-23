import type { NormalizedReplay } from '../types/replay';

export interface WorkerParseRequest {
  type: 'PARSE_FILE';
  file: File;
}

export interface WorkerDemoRequest {
  type: 'LOAD_DEMO';
}

export type ReplayWorkerRequest = WorkerParseRequest | WorkerDemoRequest;

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  progress: number;
  message: string;
}

export interface WorkerSuccessMessage {
  type: 'SUCCESS';
  replay: NormalizedReplay;
}

export interface WorkerErrorMessage {
  type: 'ERROR';
  error: string;
}

export type ReplayWorkerResponse = WorkerProgressMessage | WorkerSuccessMessage | WorkerErrorMessage;

