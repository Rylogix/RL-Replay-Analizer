import type { NormalizedReplay } from '../types/replay';

export interface WorkerParseRequest {
  type: 'PARSE_FILE';
  file: File;
}

export type ReplayWorkerRequest = WorkerParseRequest;

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
