import { useRef } from 'react';
import type { StoredReplaySession } from '../../lib/storage/db';
import { Panel } from '../../components/Panel';

interface UploadPanelProps {
  sessions: StoredReplaySession[];
  onFileSelected: (file: File) => void;
  onLoadDemo: () => void;
  onExport: () => void;
  onOpenSession: (replayHash: string) => void;
  onDeleteSession: (replayHash: string) => void;
  error: string | null;
}

export const UploadPanel = ({
  sessions,
  onFileSelected,
  onLoadDemo,
  onExport,
  onOpenSession,
  onDeleteSession,
  error
}: UploadPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Panel
      title="ReplayForge"
      subtitle="Static client-side Rocket League replay analysis for GitHub Pages"
      action={
        <button type="button" className="ghost-button" onClick={onExport}>
          Export JSON
        </button>
      }
      className="upload-panel"
    >
      <div className="upload-panel__cta">
        <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
          Upload `.replay` or normalized `.json`
        </button>
        <button type="button" className="secondary-button" onClick={onLoadDemo}>
          Load demo session
        </button>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".replay,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelected(file);
            event.target.value = '';
          }
        }}
      />

      <div className="upload-panel__notes">
        <p>`.replay` parsing runs locally in a Web Worker via a browser-loaded WASM parser. Some advanced event timings are still inferred from replay state and direct summary stats.</p>
        {error ? <p className="upload-panel__error">{error}</p> : null}
      </div>

      <div className="session-list">
        <div className="session-list__header">
          <h3>IndexedDB Sessions</h3>
          <span>{sessions.length}</span>
        </div>
        {sessions.length ? (
          sessions.map((session) => (
            <div key={session.replayHash} className="session-list__item">
              <button type="button" onClick={() => onOpenSession(session.replayHash)}>
                <strong>{session.title}</strong>
                <span>{new Date(session.updatedAt).toLocaleString()}</span>
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Delete ${session.title}`}
                onClick={() => onDeleteSession(session.replayHash)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="muted">No locally cached sessions yet.</p>
        )}
      </div>
    </Panel>
  );
};
