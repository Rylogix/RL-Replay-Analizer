export const LoadingOverlay = ({
  open,
  progress,
  message
}: {
  open: boolean;
  progress: number;
  message: string;
}) =>
  open ? (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay__card">
        <p className="eyebrow">Browser Worker</p>
        <h3>Parsing locally</h3>
        <p>{message}</p>
        <div className="progress">
          <div className="progress__bar" style={{ width: `${progress}%` }} />
        </div>
        <p className="loading-overlay__value">{Math.round(progress)}%</p>
      </div>
    </div>
  ) : null;

