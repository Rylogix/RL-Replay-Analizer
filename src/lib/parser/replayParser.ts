import type { NormalizedReplay } from '../../types/replay';
import { normalizeReplay } from './normalize';

export class ParserIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParserIntegrationError';
  }
}

interface ParseReplayInput {
  fileName: string;
  fileSize: number;
  buffer: ArrayBuffer;
}

export interface BrowserReplayAdapter {
  id: string;
  parse(input: ParseReplayInput): Promise<NormalizedReplay | null>;
}

const browserWasmPlaceholderAdapter: BrowserReplayAdapter = {
  id: 'wasm-adapter-placeholder',
  async parse() {
    return null;
  }
};

const adapters: BrowserReplayAdapter[] = [browserWasmPlaceholderAdapter];

export const parseImportedJson = (payload: unknown): NormalizedReplay => {
  if (!payload || typeof payload !== 'object' || !('meta' in payload)) {
    throw new ParserIntegrationError('Imported JSON does not match the ReplayForge normalized replay schema.');
  }

  return normalizeReplay(payload as NormalizedReplay);
};

export const parseReplayArrayBuffer = async (input: ParseReplayInput): Promise<NormalizedReplay> => {
  for (const adapter of adapters) {
    const parsed = await adapter.parse(input);
    if (parsed) {
      return normalizeReplay(parsed);
    }
  }

  throw new ParserIntegrationError(
    [
      `No browser parser adapter could parse "${input.fileName}".`,
      'ReplayForge is scaffolded for GitHub Pages and expects a browser-runnable WASM parser to be wired here.',
      'Use the demo session or import previously exported normalized JSON until the replay adapter is implemented.'
    ].join(' '),
  );
};

