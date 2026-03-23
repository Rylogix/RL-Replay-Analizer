import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, Euler, Vector3 as ThreeVector3 } from 'three';
import { getInterpolatedFrameAtTime } from '../../lib/analytics/selectors';
import { BOOST_PAD_POSITIONS, FIELD_DIMENSIONS } from '../../lib/utils/field';
import { Panel } from '../../components/Panel';
import { formatClock } from '../../lib/utils/format';
import type { CameraMode, CarState, NormalizedReplay, Player, ReplayEventType } from '../../types/replay';

const SCALE = 0.0018;
const FREE_CAMERA_SPEED = 8.5;
const FREE_CAMERA_VERTICAL_SPEED = 5.5;
const MOUSE_SENSITIVITY = 0.0025;
const BALL_RADIUS = 0.19;

const teamColor = (teamId?: string) => (teamId === 'orange' ? '#ff8b35' : '#35c8ff');
const vec = (x: number, y: number, z: number) => new ThreeVector3(x * SCALE, z * SCALE, y * SCALE);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const cameraModeLabel: Record<CameraMode, string> = {
  free: 'Free POV',
  followBall: 'Follow Ball',
  followPlayer: 'Follow Player',
  tactical: 'Tactical',
};

const GoalFrame = ({ side }: { side: 'blue' | 'orange' }) => {
  const direction = side === 'blue' ? 1 : -1;
  const color = side === 'blue' ? '#2f88ff' : '#ff8b35';
  const goalY = direction * (FIELD_DIMENSIONS.halfLength * SCALE + 0.62);
  const width = FIELD_DIMENSIONS.goalWidth * SCALE;

  return (
    <group position={[0, 0.42, goalY]}>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[width, 0.06, 0.06]} />
        <meshStandardMaterial color="#dff8ff" emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-width / 2 + 0.03, 0.12, 0]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#dff8ff" emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[width / 2 - 0.03, 0.12, 0]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color="#dff8ff" emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.12, direction * 0.4]}>
        <boxGeometry args={[width - 0.1, 0.22, 0.03]} />
        <meshStandardMaterial color={color} transparent opacity={0.18} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0.02, direction * 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.12, 0.72]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

const BoostPad = ({ x, y, z, isLarge }: { x: number; y: number; z: number; isLarge: boolean }) => {
  const position = vec(x, y, z);
  const radius = isLarge ? 0.16 : 0.11;

  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[radius, radius + 0.02, 0.03, 24]} />
        <meshStandardMaterial color="#1d2a36" metalness={0.25} roughness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.7, radius, 28]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.95} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[isLarge ? 0.05 : 0.03, 18, 18]} />
        <meshStandardMaterial color="#ffefad" emissive="#ffb347" emissiveIntensity={1.15} />
      </mesh>
    </group>
  );
};

const BallProxy = ({
  position,
  activeColor,
  highlighted,
}: {
  position: ThreeVector3;
  activeColor: Color;
  highlighted: boolean;
}) => (
  <group position={position}>
    <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.12, 0.18, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.24} />
    </mesh>
    <mesh>
      <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
      <meshStandardMaterial color="#eef7ff" metalness={0.35} roughness={0.18} emissive={activeColor} emissiveIntensity={highlighted ? 0.75 : 0.2} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[BALL_RADIUS * 0.72, 0.012, 12, 28]} />
      <meshStandardMaterial color="#8fb4d9" metalness={0.45} roughness={0.2} />
    </mesh>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[BALL_RADIUS * 0.72, 0.012, 12, 28]} />
      <meshStandardMaterial color="#8fb4d9" metalness={0.45} roughness={0.2} />
    </mesh>
    {highlighted ? (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -BALL_RADIUS - 0.05, 0]}>
        <ringGeometry args={[0.26, 0.38, 36]} />
        <meshBasicMaterial color={activeColor} transparent opacity={0.75} />
      </mesh>
    ) : null}
  </group>
);

const CarProxy = ({
  car,
  player,
  selected,
}: {
  car: CarState;
  player?: Player;
  selected: boolean;
}) => {
  const bodyColor = teamColor(player?.teamId);
  const position = vec(car.position.x, car.position.y, car.position.z + 34);
  const rotation: [number, number, number] = [car.rotation.x * 0.12, -car.rotation.y, car.rotation.z * 0.12];

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.28, 24]} />
        <meshBasicMaterial color={selected ? '#ffffff' : bodyColor} transparent opacity={selected ? 0.38 : 0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[0.46, 0.12, 0.82]} />
        <meshStandardMaterial color={bodyColor} metalness={0.42} roughness={0.24} emissive={selected ? '#d8fbff' : '#000000'} emissiveIntensity={selected ? 0.42 : 0} />
      </mesh>
      <mesh castShadow position={[0, 0.11, -0.04]}>
        <boxGeometry args={[0.28, 0.1, 0.36]} />
        <meshStandardMaterial color="#f2f7fb" metalness={0.25} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.03, 0.36]} rotation={[0.35, 0, 0]}>
        <coneGeometry args={[0.15, 0.22, 6]} />
        <meshStandardMaterial color="#c9f4ff" emissive="#8ce3ff" emissiveIntensity={0.25} />
      </mesh>
      {[
        [-0.18, -0.07, -0.24],
        [0.18, -0.07, -0.24],
        [-0.18, -0.07, 0.24],
        [0.18, -0.07, 0.24],
      ].map(([x, y, z], index) => (
        <mesh key={index} castShadow position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.075, 0.075, 0.06, 18]} />
          <meshStandardMaterial color="#0c1014" roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0, 0.08, -0.2]}>
        <boxGeometry args={[0.18, 0.05, 0.02]} />
        <meshStandardMaterial color="#13212c" />
      </mesh>
      <Html position={[0, 0.42, 0]} center distanceFactor={14}>
        <div className={`viewer-label ${selected ? 'viewer-label--selected' : ''}`}>{player?.name ?? 'Unknown'}</div>
      </Html>
    </group>
  );
};

const CameraController = ({
  mode,
  followPosition,
  targetPosition,
  lockElement,
}: {
  mode: CameraMode;
  followPosition: ThreeVector3;
  targetPosition: ThreeVector3;
  lockElement: HTMLDivElement | null;
}) => {
  const { camera } = useThree();
  const pressedKeys = useRef(new Set<string>());
  const freeCamera = useRef({
    position: new ThreeVector3(0, 4.8, -8.8),
    yaw: 0,
    pitch: -0.18,
  });
  const wasFreeMode = useRef(false);

  useEffect(() => {
    if (mode !== 'free') {
      wasFreeMode.current = false;
      return;
    }

    if (!wasFreeMode.current) {
      const direction = new ThreeVector3();
      camera.getWorldDirection(direction);
      freeCamera.current.position.copy(camera.position);
      freeCamera.current.yaw = Math.atan2(direction.x, direction.z);
      freeCamera.current.pitch = clamp(Math.asin(direction.y), -1.2, 1.2);
      wasFreeMode.current = true;
    }
  }, [camera, mode]);

  useEffect(() => {
    if (mode !== 'free') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.pointerLockElement !== lockElement) {
        return;
      }

      pressedKeys.current.add(event.code);
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.code);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== lockElement) {
        return;
      }

      freeCamera.current.yaw -= event.movementX * MOUSE_SENSITIVITY;
      freeCamera.current.pitch = clamp(
        freeCamera.current.pitch - event.movementY * MOUSE_SENSITIVITY,
        -1.22,
        1.22,
      );
    };

    const clearKeys = () => {
      pressedKeys.current.clear();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('blur', clearKeys);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('blur', clearKeys);
      pressedKeys.current.clear();
    };
  }, [lockElement, mode]);

  useFrame((_, delta) => {
    if (mode === 'free') {
      const cameraState = freeCamera.current;
      const forward = new ThreeVector3(Math.sin(cameraState.yaw), 0, Math.cos(cameraState.yaw)).normalize();
      const right = new ThreeVector3(forward.z, 0, -forward.x).normalize();
      const boostMultiplier = pressedKeys.current.has('ShiftLeft') || pressedKeys.current.has('ShiftRight') ? 1.8 : 1;
      const moveDistance = FREE_CAMERA_SPEED * boostMultiplier * delta;

      if (pressedKeys.current.has('KeyW') || pressedKeys.current.has('ArrowUp')) {
        cameraState.position.addScaledVector(forward, moveDistance);
      }
      if (pressedKeys.current.has('KeyS') || pressedKeys.current.has('ArrowDown')) {
        cameraState.position.addScaledVector(forward, -moveDistance);
      }
      if (pressedKeys.current.has('KeyD') || pressedKeys.current.has('ArrowRight')) {
        cameraState.position.addScaledVector(right, moveDistance);
      }
      if (pressedKeys.current.has('KeyA') || pressedKeys.current.has('ArrowLeft')) {
        cameraState.position.addScaledVector(right, -moveDistance);
      }
      if (pressedKeys.current.has('KeyQ')) {
        cameraState.position.y += FREE_CAMERA_VERTICAL_SPEED * delta;
      }
      if (pressedKeys.current.has('KeyE')) {
        cameraState.position.y -= FREE_CAMERA_VERTICAL_SPEED * delta;
      }

      camera.position.copy(cameraState.position);
      camera.quaternion.setFromEuler(new Euler(cameraState.pitch, cameraState.yaw, 0, 'YXZ'));
      return;
    }

    const desired = new ThreeVector3(0, 10, -9);
    if (mode === 'followBall') {
      desired.copy(targetPosition).add(new ThreeVector3(0, 3.6, -4.8));
    } else if (mode === 'followPlayer') {
      desired.copy(followPosition).add(new ThreeVector3(0, 2.6, -3.5));
    } else if (mode === 'tactical') {
      desired.set(0, 14, 0.001);
    }

    camera.position.lerp(desired, 0.085);
    camera.lookAt(mode === 'tactical' ? new ThreeVector3(0, 0.15, 0) : targetPosition);
  });

  return null;
};

const FieldScene = ({
  replay,
  currentTime,
  selectedPlayerId,
  cameraMode,
  lockElement,
}: {
  replay: NormalizedReplay;
  currentTime: number;
  selectedPlayerId: string | null;
  cameraMode: CameraMode;
  lockElement: HTMLDivElement | null;
}) => {
  const frame = useMemo(() => getInterpolatedFrameAtTime(replay, currentTime), [currentTime, replay]);
  const activeEvent = useMemo(
    () =>
      replay.timeline.find(
        (event) => Math.abs(event.time - currentTime) <= 0.35 && ['goal', 'demo', 'boost', 'shot'].includes(event.type),
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
      aerial: '#35c8ff',
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
  const focusPosition = focusCar ? vec(focusCar.position.x, focusCar.position.y, focusCar.position.z) : ballPosition;

  return (
    <>
      <color attach="background" args={['#050c14']} />
      <fog attach="fog" args={['#050c14', 10, 28]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#89d6ff', '#051019', 0.55]} />
      <directionalLight position={[4, 10, -3]} intensity={1.75} castShadow />
      <spotLight position={[0, 12, 0]} angle={0.52} intensity={0.6} penumbra={0.55} color="#9fd6ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.035, 0]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2.2 * SCALE, FIELD_DIMENSIONS.halfLength * 2.2 * SCALE]} />
        <meshStandardMaterial color="#050b12" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, FIELD_DIMENSIONS.halfLength * 2 * SCALE]} />
        <meshStandardMaterial color="#0f2230" roughness={0.9} metalness={0.06} />
      </mesh>

      {[-0.72, -0.36, 0, 0.36, 0.72].map((offset, index) => (
        <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002 + index * 0.001, offset * FIELD_DIMENSIONS.halfLength * SCALE]}>
          <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 1.92 * SCALE, FIELD_DIMENSIONS.halfLength * 0.28 * SCALE]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#102736' : '#132f41'} transparent opacity={0.52} />
        </mesh>
      ))}

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2, 2.18, 72]} />
        <meshBasicMaterial color="#204964" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, 0.04]} />
        <meshBasicMaterial color="#2b5977" transparent opacity={0.85} />
      </mesh>

      {[
        [0, FIELD_DIMENSIONS.halfLength * SCALE],
        [0, -FIELD_DIMENSIONS.halfLength * SCALE],
        [FIELD_DIMENSIONS.halfWidth * SCALE, 0],
        [-FIELD_DIMENSIONS.halfWidth * SCALE, 0],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 0.18, z]}>
          <boxGeometry args={index < 2 ? [FIELD_DIMENSIONS.halfWidth * 2 * SCALE, 0.36, 0.05] : [0.05, 0.36, FIELD_DIMENSIONS.halfLength * 2 * SCALE]} />
          <meshStandardMaterial color="#17384d" transparent opacity={0.2} />
        </mesh>
      ))}

      {BOOST_PAD_POSITIONS.map((pad, index) => (
        <BoostPad key={index} x={pad.x} y={pad.y} z={pad.z} isLarge={index < 4} />
      ))}

      <GoalFrame side="blue" />
      <GoalFrame side="orange" />

      <BallProxy position={ballPosition} activeColor={highlightColor} highlighted={Boolean(activeEvent)} />

      {frame.cars.map((car) => {
        const player = replay.players.find((entry) => entry.id === car.playerId);
        return <CarProxy key={car.playerId} car={car} player={player} selected={selectedPlayerId === car.playerId} />;
      })}

      <CameraController
        mode={cameraMode}
        followPosition={focusPosition}
        targetPosition={cameraMode === 'followPlayer' ? focusPosition.clone().lerp(ballPosition, 0.7) : ballPosition}
        lockElement={lockElement}
      />
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
  onSelectPlayer: (playerId: string | null) => void;
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
  onSetCameraMode,
  onSelectPlayer,
}: ReplayViewerProps) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);

  const effectivePlayerId = selectedPlayerId ?? replay.players[0]?.id ?? null;

  useEffect(() => {
    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === stageRef.current);
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, []);

  useEffect(() => {
    if (cameraMode !== 'free' && document.pointerLockElement === stageRef.current) {
      document.exitPointerLock();
    }
  }, [cameraMode]);

  return (
    <Panel
      title="3D Replay Viewer"
      subtitle={`Stylized proxy arena with synchronized playback at ${formatClock(currentTime)}`}
      className="viewer-panel"
    >
      <div className="viewer-toolbar viewer-toolbar--stacked">
        <div className="viewer-toolbar__modes">
          {(['free', 'followBall', 'followPlayer', 'tactical'] as CameraMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`chip ${cameraMode === mode ? 'chip--active' : ''}`}
              onClick={() => onSetCameraMode(mode)}
            >
              {cameraModeLabel[mode]}
            </button>
          ))}
        </div>
        {cameraMode === 'followPlayer' ? (
          <label className="viewer-player-picker">
            <span>Focused player</span>
            <select value={effectivePlayerId ?? ''} onChange={(event) => onSelectPlayer(event.target.value || null)}>
              {replay.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.teamId})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div
        ref={stageRef}
        className={`viewer-stage ${cameraMode === 'free' ? 'viewer-stage--free' : ''}`}
        data-replayforge-viewer="true"
        onClick={() => {
          if (cameraMode === 'free' && stageRef.current && document.pointerLockElement !== stageRef.current) {
            stageRef.current.requestPointerLock();
          }
        }}
      >
        {cameraMode === 'free' ? (
          <div className="viewer-stage__hint">
            {pointerLocked
              ? 'Free POV active: mouse look, WASD or arrows move, Q/E change height, Shift accelerates, Esc releases.'
              : 'Click the viewport to lock the mouse. Free POV uses mouse look plus WASD or arrow-key movement.'}
          </div>
        ) : null}
        <Canvas camera={{ position: [0, 10, -9], fov: 48 }} shadows>
          <FieldScene
            replay={replay}
            currentTime={currentTime}
            selectedPlayerId={effectivePlayerId}
            cameraMode={cameraMode}
            lockElement={stageRef.current}
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
};
