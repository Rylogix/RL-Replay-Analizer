import { useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Color, Vector3 as ThreeVector3 } from 'three';
import { getInterpolatedFrameAtTime } from '../../lib/analytics/selectors';
import { BOOST_PAD_POSITIONS, FIELD_DIMENSIONS } from '../../lib/utils/field';
import type { CameraMode, NormalizedReplay, ReplayEventType } from '../../types/replay';
import { Panel } from '../../components/Panel';
import { formatClock } from '../../lib/utils/format';

const SCALE = 0.0018;

const teamColor = (teamId?: string) => (teamId === 'orange' ? '#ff8b35' : '#35c8ff');
const vec = (x: number, y: number, z: number) => new ThreeVector3(x * SCALE, z * SCALE, y * SCALE);

const CameraRig = ({
  mode,
  followPosition,
  targetPosition
}: {
  mode: CameraMode;
  followPosition: ThreeVector3;
  targetPosition: ThreeVector3;
}) => {
  const { camera } = useThree();

  useFrame(() => {
    const desired = new ThreeVector3(0, 10, -9);
    if (mode === 'followBall') {
      desired.copy(followPosition).add(new ThreeVector3(0, 3.5, -4.5));
    } else if (mode === 'followPlayer') {
      desired.copy(followPosition).add(new ThreeVector3(0, 2.5, -3.4));
    } else if (mode === 'tactical') {
      desired.set(0, 13, 0.001);
    }

    camera.position.lerp(desired, 0.08);
    camera.lookAt(mode === 'tactical' ? new ThreeVector3(0, 0, 0) : targetPosition);
  });

  return null;
};

const FieldScene = ({
  replay,
  currentTime,
  selectedPlayerId,
  cameraMode
}: {
  replay: NormalizedReplay;
  currentTime: number;
  selectedPlayerId: string | null;
  cameraMode: CameraMode;
}) => {
  const frame = useMemo(() => getInterpolatedFrameAtTime(replay, currentTime), [currentTime, replay]);
  const activeEvent = useMemo(
    () =>
      replay.timeline.find(
        (event) =>
          Math.abs(event.time - currentTime) <= 0.4 &&
          ['goal', 'demo', 'boost', 'shot'].includes(event.type),
      ),
    [currentTime, replay.timeline],
  );

  const highlightColor = useMemo(() => {
    const byType: Record<ReplayEventType | 'default', string> = {
      default: '#35c8ff',
      goal: '#fff08a',
      shot: '#8bffe4',
      save: '#35c8ff',
      demo: '#ff5f5f',
      bump: '#35c8ff',
      boost: '#9ff57d',
      touch: '#35c8ff',
      kickoff: '#35c8ff',
      possession: '#35c8ff',
      pressure: '#35c8ff',
      aerial: '#35c8ff'
    };
    return new Color(byType[activeEvent?.type ?? 'default']);
  }, [activeEvent]);

  if (!frame) {
    return null;
  }

  const focusCar =
    frame.cars.find((car) => car.playerId === selectedPlayerId) ??
    frame.cars.find((car) => car.playerId === replay.players[0]?.id);
  const ballPosition = vec(frame.ball.position.x, frame.ball.position.y, frame.ball.position.z);
  const focusPosition = focusCar
    ? vec(focusCar.position.x, focusCar.position.y, focusCar.position.z)
    : ballPosition;

  return (
    <>
      <color attach="background" args={['#081018']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 12, -6]} intensity={1.3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, FIELD_DIMENSIONS.halfLength * 2 * SCALE]} />
        <meshStandardMaterial color="#0d1722" />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.18, 64]} />
        <meshBasicMaterial color="#163447" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, 0.03]} />
        <meshBasicMaterial color="#163447" />
      </mesh>
      {BOOST_PAD_POSITIONS.map((pad, index) => (
        <mesh key={index} position={vec(pad.x, pad.y, pad.z)}>
          <cylinderGeometry args={[0.12, 0.12, 0.03, 18]} />
          <meshStandardMaterial color="#f6c453" emissive="#d27f14" emissiveIntensity={0.25} />
        </mesh>
      ))}
      <mesh position={vec(0, FIELD_DIMENSIONS.halfLength, 210)}>
        <boxGeometry args={[FIELD_DIMENSIONS.goalWidth * SCALE, 0.8, 0.14]} />
        <meshStandardMaterial color="#1d3d52" transparent opacity={0.8} />
      </mesh>
      <mesh position={vec(0, -FIELD_DIMENSIONS.halfLength, 210)}>
        <boxGeometry args={[FIELD_DIMENSIONS.goalWidth * SCALE, 0.8, 0.14]} />
        <meshStandardMaterial color="#4c2718" transparent opacity={0.8} />
      </mesh>
      <group position={ballPosition}>
        <mesh>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#f4fafb" emissive={highlightColor} emissiveIntensity={activeEvent ? 0.8 : 0.18} />
        </mesh>
        {activeEvent ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.24, 0.34, 32]} />
            <meshBasicMaterial color={highlightColor} transparent opacity={0.65} />
          </mesh>
        ) : null}
      </group>
      {frame.cars.map((car) => {
        const player = replay.players.find((entry) => entry.id === car.playerId);
        return (
          <group key={car.playerId} position={vec(car.position.x, car.position.y, car.position.z + 34)}>
            <mesh rotation={[0, -car.rotation.y, 0]}>
              <boxGeometry args={[0.42, 0.18, 0.7]} />
              <meshStandardMaterial
                color={teamColor(player?.teamId)}
                emissive={selectedPlayerId === car.playerId ? '#ffffff' : '#000000'}
                emissiveIntensity={selectedPlayerId === car.playerId ? 0.3 : 0}
              />
            </mesh>
            <mesh position={[0, 0.02, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.08, 0.16, 6]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          </group>
        );
      })}
      <CameraRig mode={cameraMode} followPosition={focusPosition} targetPosition={ballPosition} />
      <OrbitControls enabled={cameraMode === 'free'} enablePan={cameraMode === 'free'} enableZoom minDistance={3} maxDistance={22} />
    </>
  );
};

interface ReplayViewerProps {
  replay: NormalizedReplay;
  currentTime: number;
  selectedPlayerId: string | null;
  cameraMode: CameraMode;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onStep: (delta: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  playbackSpeed: number;
  onSetCameraMode: (mode: CameraMode) => void;
}

export const ReplayViewer3D = ({
  replay,
  currentTime,
  selectedPlayerId,
  cameraMode,
  onTogglePlayback,
  onSeek,
  onStep,
  onSetPlaybackSpeed,
  playbackSpeed,
  onSetCameraMode
}: ReplayViewerProps) => (
  <Panel
    title="3D Replay Viewer"
    subtitle={`Stylized proxy arena with synchronized playback at ${formatClock(currentTime)}`}
    className="viewer-panel"
    action={
      <div className="viewer-toolbar">
        {(['free', 'followBall', 'followPlayer', 'tactical'] as CameraMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`chip ${cameraMode === mode ? 'chip--active' : ''}`}
            onClick={() => onSetCameraMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    }
  >
    <div className="viewer-stage">
      <Canvas camera={{ position: [0, 10, -9], fov: 48 }}>
        <FieldScene
          replay={replay}
          currentTime={currentTime}
          selectedPlayerId={selectedPlayerId}
          cameraMode={cameraMode}
        />
      </Canvas>
    </div>
    <div className="viewer-controls">
      <button type="button" onClick={() => onStep(-5)}>
        Prev event
      </button>
      <button type="button" className="primary-button" onClick={onTogglePlayback}>
        Play / Pause
      </button>
      <button type="button" onClick={() => onStep(5)}>
        Next event
      </button>
      <div className="viewer-controls__speeds">
        {[0.5, 1, 1.5, 2].map((speed) => (
          <button
            key={speed}
            type="button"
            className={`chip ${speed === playbackSpeed ? 'chip--active' : ''}`}
            onClick={() => onSetPlaybackSpeed(speed)}
          >
            {speed}x
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={replay.meta.durationSeconds}
        value={currentTime}
        step={0.1}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
    </div>
  </Panel>
);

