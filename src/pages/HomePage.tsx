import { lazy, Suspense } from 'react';
import { UploadPanel } from '../features/upload/UploadPanel';
import { TimelineBar } from '../features/timeline/TimelineBar';
import { Tabs } from '../components/Tabs';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { OverviewPanel } from '../features/analytics/OverviewPanel';
import { PlayersPanel } from '../features/analytics/PlayersPanel';
import { useReplayForgeStore } from '../app/store';
import { Panel } from '../components/Panel';

const ReplayViewer3D = lazy(() =>
  import('../features/viewer/ReplayViewer3D').then((module) => ({ default: module.ReplayViewer3D })),
);
const AnalyticsPanel = lazy(() =>
  import('../features/analytics/AnalyticsPanel').then((module) => ({ default: module.AnalyticsPanel })),
);

const LazyPanelFallback = ({ label }: { label: string }) => (
  <Panel title={label} subtitle="Loading client bundle slice">
    <p className="muted">Preparing this panel in the browser.</p>
  </Panel>
);

export const HomePage = () => {
  const {
    replay,
    sessions,
    selectedTab,
    selectedPlayerId,
    currentTime,
    isPlaying,
    playbackSpeed,
    loading,
    parseProgress,
    parseMessage,
    error,
    eventFilters,
    parseFile,
    openSession,
    deleteSession,
    exportCurrentReplay,
    seek,
    togglePlayback,
    setPlaybackSpeed,
    setSelectedTab,
    setSelectedPlayerId,
    setEventFilter
  } = useReplayForgeStore();

  return (
    <>
      <LoadingOverlay open={loading} progress={parseProgress} message={parseMessage} />
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">RLStatLab</p>
            <h1>Rocket League replay analysis</h1>
            <p>
              Upload a local `.replay`, parse it in a Web Worker, cache normalized sessions in IndexedDB,
              and inspect custom analytics, 3D playback, timelines, and replay-derived player metrics without a backend.
            </p>
          </div>
        </header>

        <UploadPanel
          sessions={sessions}
          onFileSelected={parseFile}
          onExport={exportCurrentReplay}
          onOpenSession={openSession}
          onDeleteSession={deleteSession}
          error={error}
        />

        {!replay ? (
          <Panel title="Empty State" subtitle="No replay loaded yet" className="empty-state">
            <p>
              Upload a local `.replay` or import a previously exported normalized JSON file. Parsing stays in the
              browser, and unsupported analytics remain labeled explicitly inside the app.
            </p>
          </Panel>
        ) : (
          <>
            <section className="workspace-grid">
              <section className="workspace-grid__center">
                <Suspense fallback={<LazyPanelFallback label="3D Replay Viewer" />}>
                  <ReplayViewer3D
                    replay={replay}
                    currentTime={currentTime}
                    selectedPlayerId={selectedPlayerId}
                    isPlaying={isPlaying}
                    onTogglePlayback={togglePlayback}
                    onSeek={seek}
                    onSetPlaybackSpeed={setPlaybackSpeed}
                    playbackSpeed={playbackSpeed}
                  />
                </Suspense>
              </section>
            </section>

            <section className="tabs-shell">
              <Tabs
                value={selectedTab}
                onChange={setSelectedTab}
                options={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'players', label: 'Players' },
                  { id: 'analytics', label: 'Analytics' }
                ]}
              />

              {selectedTab === 'overview' ? <OverviewPanel replay={replay} /> : null}
              {selectedTab === 'players' ? (
                <PlayersPanel replay={replay} />
              ) : null}
              {selectedTab === 'analytics' ? (
                <Suspense fallback={<LazyPanelFallback label="Advanced Analytics" />}>
                  <AnalyticsPanel replay={replay} selectedPlayerId={selectedPlayerId} />
                </Suspense>
              ) : null}
            </section>

            <TimelineBar
              replay={replay}
              currentTime={currentTime}
              filters={eventFilters}
              onSeek={seek}
              onToggleFilter={setEventFilter}
            />
          </>
        )}
      </main>
    </>
  );
};
