import { useRef } from 'react';
import type { StoredReplaySession } from '../../lib/storage/db';
import { getReplayTitle } from '../../lib/utils/replayTitle';
import { Panel } from '../../components/Panel';

interface UploadPanelProps {
  sessions: StoredReplaySession[];
  onFileSelected: (file: File) => void;
  onOpenSession: (replayHash: string) => void;
  onDeleteSession: (replayHash: string) => void;
  error: string | null;
}

export const UploadPanel = ({
  sessions,
  onFileSelected,
  onOpenSession,
  onDeleteSession,
  error,
}: UploadPanelProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Panel className="upload-panel">
      <div className="upload-panel__howto">
        <strong>Find your `.replay` files:</strong>
        <span>`Documents/My Games/Rocket League/TAGame/Demos` or `DemosEpic`</span>
      </div>
      <div className="upload-panel__cta">
        <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
          Upload `.replay` or normalized `.json`
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
        {error ? <p className="upload-panel__error">{error}</p> : null}
      </div>

      <div className="session-list">
        <div className="session-list__header">
          <h3>Replay Sessions</h3>
          <span>{sessions.length}</span>
        </div>
        {sessions.length ? (
          sessions.map((session) => {
            const title = getReplayTitle(session.replay);
            return (
              <div key={session.replayHash} className="session-list__item">
                <button type="button" onClick={() => onOpenSession(session.replayHash)}>
                  <strong>{title}</strong>
                  <span>{new Date(session.updatedAt).toLocaleString()}</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Delete ${title}`}
                  onClick={() => onDeleteSession(session.replayHash)}
                >
                  x
                </button>
              </div>
            );
          })
        ) : (
          <p className="muted">No locally cached sessions yet.</p>
        )}
      </div>
    </Panel>
  );
};
