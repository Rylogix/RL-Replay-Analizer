import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, MathUtils, Vector3 as ThreeVector3 } from 'three';
import { getInterpolatedFrameAtTime } from '../../lib/analytics/selectors';
import { BOOST_PAD_POSITIONS, FIELD_DIMENSIONS } from '../../lib/utils/field';
import { Panel } from '../../components/Panel';
import { formatClock } from '../../lib/utils/format';
import type { CarState, NormalizedReplay, Player, ReplayEventType } from '../../types/replay';

const SCALE = 0.0018;
const BALL_RADIUS = 0.19;
const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 3, 4] as const;

const teamColor = (teamId?: string) => (teamId === 'orange' ? '#d4a017' : '#4da3ff');
const vec = (x: number, y: number, z: number) => new ThreeVector3(x * SCALE, z * SCALE, y * SCALE);
const speedOf = (car: CarState) =>
  Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2 + car.velocity.z ** 2);

const FieldLine = ({
  width,
  depth,
  x = 0,
  z = 0,
  color = '#d6dde6',
  opacity = 0.78,
}: {
  width: number;
  depth: number;
  x?: number;
  z?: number;
  color?: string;
  opacity?: number;
}) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial color={color} transparent opacity={opacity} />
  </mesh>
);

const ArenaShell = () => {
  const wallHeight = 1.08;
  const wallThickness = 0.06;
  const width = FIELD_DIMENSIONS.halfWidth * 2 * SCALE;
  const length = FIELD_DIMENSIONS.halfLength * 2 * SCALE;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.025, 0]}>
        <planeGeometry args={[width * 1.1, length * 1.1]} />
        <meshStandardMaterial color="#06080a" roughness={1} />
      </mesh>

      <mesh position={[0, wallHeight / 2, length / 2 + wallThickness / 2]}>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshPhysicalMaterial color="#0f1419" roughness={0.26} metalness={0.18} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, wallHeight / 2, -length / 2 - wallThickness / 2]}>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshPhysicalMaterial color="#0f1419" roughness={0.26} metalness={0.18} transparent opacity={0.7} />
      </mesh>
      <mesh position={[width / 2 + wallThickness / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, length]} />
        <meshPhysicalMaterial color="#0f1419" roughness={0.26} metalness={0.18} transparent opacity={0.62} />
      </mesh>
      <mesh position={[-width / 2 - wallThickness / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, length]} />
        <meshPhysicalMaterial color="#0f1419" roughness={0.26} metalness={0.18} transparent opacity={0.62} />
      </mesh>

      {[1, -1].flatMap((sx) =>
        [1, -1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[sx * (width / 2 + wallThickness / 3), wallHeight / 2, sz * (length / 2 + wallThickness / 3)]}
          >
            <cylinderGeometry args={[0.06, 0.06, wallHeight, 12]} />
            <meshStandardMaterial color="#182028" metalness={0.3} roughness={0.34} />
          </mesh>
        )),
      )}
    </group>
  );
};

const FieldMarkings = () => {
  const width = FIELD_DIMENSIONS.halfWidth * 2 * SCALE;
  const length = FIELD_DIMENSIONS.halfLength * 2 * SCALE;
  const goalBoxWidth = 2.45;
  const goalBoxDepth = 1.62;
  const diagonalMarkers = [-0.72, -0.38, 0.38, 0.72];

  return (
    <group>
      <FieldLine width={width} depth={0.05} z={length / 2 - 0.04} opacity={0.4} />
      <FieldLine width={width} depth={0.05} z={-length / 2 + 0.04} opacity={0.4} />
      <FieldLine width={0.05} depth={length} x={width / 2 - 0.04} opacity={0.4} />
      <FieldLine width={0.05} depth={length} x={-width / 2 + 0.04} opacity={0.4} />
      <FieldLine width={width} depth={0.045} />

      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.02, 0.03, 12, 72]} />
        <meshBasicMaterial color="#dbe3ee" transparent opacity={0.82} />
      </mesh>

      {diagonalMarkers.map((offset) => (
        <FieldLine
          key={offset}
          width={width * 0.82}
          depth={0.02}
          z={offset * (length / 2)}
          color="#171d24"
          opacity={0.88}
        />
      ))}

      {[1, -1].map((direction) => {
        const zOffset = direction * (length / 2 - goalBoxDepth / 2 - 0.18);
        return (
          <group key={direction}>
            <FieldLine width={goalBoxWidth} depth={0.04} z={zOffset - direction * goalBoxDepth / 2} opacity={0.65} />
            <FieldLine width={0.04} depth={goalBoxDepth} x={goalBoxWidth / 2} z={zOffset} opacity={0.65} />
            <FieldLine width={0.04} depth={goalBoxDepth} x={-goalBoxWidth / 2} z={zOffset} opacity={0.65} />
            <mesh position={[0, 0.012, zOffset + direction * 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.11, 18]} />
              <meshBasicMaterial color="#dbe3ee" transparent opacity={0.78} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const GoalFrame = ({ side }: { side: 'blue' | 'orange' }) => {
  const direction = side === 'blue' ? 1 : -1;
  const color = side === 'blue' ? '#4da3ff' : '#d4a017';
  const goalY = direction * (FIELD_DIMENSIONS.halfLength * SCALE + 0.59);
  const width = FIELD_DIMENSIONS.goalWidth * SCALE;
  const depth = FIELD_DIMENSIONS.goalDepth * SCALE * 0.8;

  return (
    <group position={[0, 0, goalY]}>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[width, 0.055, 0.055]} />
        <meshStandardMaterial color="#edf4fb" emissive={color} emissiveIntensity={0.18} />
      </mesh>
      {[-1, 1].map((xDir) => (
        <mesh key={xDir} position={[xDir * (width / 2 - 0.03), 0.15, 0]}>
          <boxGeometry args={[0.055, 0.36, 0.055]} />
          <meshStandardMaterial color="#edf4fb" emissive={color} emissiveIntensity={0.12} />
        </mesh>
      ))}
      <mesh position={[0, 0.18, direction * depth * 0.5]}>
        <boxGeometry args={[width - 0.08, 0.32, 0.025]} />
        <meshPhysicalMaterial color={color} roughness={0.2} metalness={0.12} transparent opacity={0.08} />
      </mesh>
      {[-0.32, -0.16, 0, 0.16, 0.32].map((x) => (
        <mesh key={x} position={[x * width, 0.16, direction * depth * 0.5]}>
          <boxGeometry args={[0.012, 0.32, 0.012]} />
          <meshStandardMaterial color="#9aa6b3" transparent opacity={0.22} />
        </mesh>
      ))}
      {[0.06, 0.14, 0.22, 0.3].map((height) => (
        <mesh key={height} position={[0, height, direction * depth * 0.5]}>
          <boxGeometry args={[width - 0.08, 0.01, 0.01]} />
          <meshStandardMaterial color="#9aa6b3" transparent opacity={0.18} />
        </mesh>
      ))}
    </group>
  );
};

const BoostPad = ({ x, y, z, isLarge }: { x: number; y: number; z: number; isLarge: boolean }) => {
  const position = vec(x, y, z);
  const radius = isLarge ? 0.16 : 0.09;

  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[radius + 0.03, radius + 0.04, 0.025, 24]} />
        <meshStandardMaterial color="#14191f" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.021, 0]}>
        <cylinderGeometry args={[radius, radius, 0.015, 24]} />
        <meshStandardMaterial color="#0c1115" roughness={0.38} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
        <ringGeometry args={[radius * 0.56, radius * 0.95, 28]} />
        <meshBasicMaterial color={isLarge ? '#d4a017' : '#22e6a8'} transparent opacity={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, Math.PI / 4, 0]} position={[0, 0.031, 0]}>
        <circleGeometry args={[radius * 0.22, 6]} />
        <meshBasicMaterial color={isLarge ? '#f4df8a' : '#aef7de'} transparent opacity={0.86} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[isLarge ? 0.03 : 0.018, 14, 14]} />
        <meshStandardMaterial
          color={isLarge ? '#f3d56e' : '#89f3cf'}
          emissive={isLarge ? '#d4a017' : '#22e6a8'}
          emissiveIntensity={0.52}
        />
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
    <mesh position={[0, -0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.12, 0.18, 36]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.18} />
    </mesh>
    <mesh castShadow>
      <sphereGeometry args={[BALL_RADIUS, 30, 30]} />
      <meshStandardMaterial
        color="#eef3f8"
        metalness={0.34}
        roughness={0.18}
        emissive={activeColor}
        emissiveIntensity={highlighted ? 0.42 : 0.08}
      />
    </mesh>
    {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation) => (
      <mesh key={rotation} rotation={[Math.PI / 2, 0, rotation]}>
        <torusGeometry args={[BALL_RADIUS * 0.67, 0.012, 10, 24]} />
        <meshStandardMaterial color="#77818e" metalness={0.4} roughness={0.28} />
      </mesh>
    ))}
  </group>
);

const BoostTrail = ({ visible }: { visible: boolean }) =>
  visible ? (
    <group position={[0, 0.01, -0.5]}>
      {[-0.08, 0.08].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.055, 0.28, 12]} />
            <meshStandardMaterial color="#eff6ff" emissive="#22e6a8" emissiveIntensity={0.72} transparent opacity={0.84} />
          </mesh>
          <mesh position={[0, 0, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.034, 0.18, 10]} />
            <meshStandardMaterial color="#4da3ff" emissive="#4da3ff" emissiveIntensity={0.64} transparent opacity={0.76} />
          </mesh>
        </group>
      ))}
    </group>
  ) : null;

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
  const position = vec(car.position.x, car.position.y, car.position.z + 28);
  const rotation: [number, number, number] = [car.rotation.x * 0.1, -car.rotation.y, car.rotation.z * 0.1];
  const boosting = car.boost > 4 && (speedOf(car) > 1450 || Boolean(car.supersonic));
  const labelClass =
    player?.teamId === 'orange' ? 'viewer-label viewer-label--orange' : 'viewer-label viewer-label--blue';

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.28, 20]} />
        <meshBasicMaterial color={selected ? '#f3f4f6' : bodyColor} transparent opacity={selected ? 0.24 : 0.09} />
      </mesh>

      <mesh castShadow position={[0, 0.03, -0.02]}>
        <boxGeometry args={[0.54, 0.11, 0.72]} />
        <meshStandardMaterial color={bodyColor} metalness={0.32} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, 0.105, -0.05]}>
        <boxGeometry args={[0.34, 0.11, 0.34]} />
        <meshStandardMaterial color={bodyColor} metalness={0.28} roughness={0.26} />
      </mesh>
      <mesh castShadow position={[0, 0.08, 0.25]} rotation={[0.72, 0, 0]}>
        <boxGeometry args={[0.4, 0.12, 0.22]} />
        <meshStandardMaterial color={bodyColor} metalness={0.26} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0.145, 0.08]} rotation={[-0.58, 0, 0]}>
        <boxGeometry args={[0.26, 0.025, 0.16]} />
        <meshStandardMaterial color="#b9c5d2" metalness={0.55} roughness={0.18} />
      </mesh>
      <mesh castShadow position={[0, 0.12, -0.17]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.28, 0.02, 0.12]} />
        <meshStandardMaterial color="#1f2630" metalness={0.44} roughness={0.26} />
      </mesh>
      <mesh castShadow position={[0, 0.12, -0.34]}>
        <boxGeometry args={[0.34, 0.025, 0.09]} />
        <meshStandardMaterial color="#252c34" metalness={0.2} roughness={0.52} />
      </mesh>
      <mesh castShadow position={[0, 0.155, -0.3]}>
        <boxGeometry args={[0.3, 0.015, 0.08]} />
        <meshStandardMaterial color="#20262f" metalness={0.24} roughness={0.44} />
      </mesh>
      <mesh position={[0, 0.05, 0.35]}>
        <boxGeometry args={[0.18, 0.035, 0.025]} />
        <meshStandardMaterial color="#f8fbff" emissive="#f8fbff" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[-0.14, 0.04, -0.38]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshStandardMaterial color="#ff9d88" emissive="#ff7c5a" emissiveIntensity={0.16} />
      </mesh>
      <mesh position={[0.14, 0.04, -0.38]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshStandardMaterial color="#ff9d88" emissive="#ff7c5a" emissiveIntensity={0.16} />
      </mesh>

      {[
        [-0.2, -0.05, -0.2],
        [0.2, -0.05, -0.2],
        [-0.2, -0.05, 0.18],
        [0.2, -0.05, 0.18],
      ].map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.09, 18]} />
            <meshStandardMaterial color="#090b0d" roughness={0.82} />
          </mesh>
          <mesh scale={0.68}>
            <cylinderGeometry args={[0.075, 0.075, 0.1, 14]} />
            <meshStandardMaterial color="#8591a0" metalness={0.68} roughness={0.28} />
          </mesh>
        </group>
      ))}

      <BoostTrail visible={boosting} />

      <Html position={[0, 0.42, 0]} center distanceFactor={12}>
        <div className={`${labelClass} ${selected ? 'viewer-label--selected' : ''}`}>{player?.name ?? 'Unknown'}</div>
      </Html>
    </group>
  );
};

const BallFollowCamera = ({
  ballPosition,
  ballVelocity,
  zoom,
}: {
  ballPosition: ThreeVector3;
  ballVelocity: ThreeVector3;
  zoom: number;
}) => {
  const { camera } = useThree();
  const directionRef = useRef(new ThreeVector3(0.16, 0, 1));
  const targetRef = useRef(new ThreeVector3());

  useFrame(() => {
    const planarVelocity = ballVelocity.clone();
    planarVelocity.y = 0;
    if (planarVelocity.lengthSq() > 0.0001) {
      directionRef.current.lerp(planarVelocity.normalize(), 0.14);
    }

    const distance = 2 + ((100 - zoom) / 100) * 5;
    const height = 1.05 + ((100 - zoom) / 100) * 2.8;
    const sideBias = MathUtils.lerp(0.25, 0.05, zoom / 100);

    const desired = ballPosition
      .clone()
      .add(directionRef.current.clone().multiplyScalar(-distance))
      .add(new ThreeVector3(sideBias, height, 0));

    targetRef.current.lerp(ballPosition.clone().add(new ThreeVector3(0, 0.28, 0)), 0.12);
    camera.position.lerp(desired, 0.08);
    camera.lookAt(targetRef.current);
  });

  return null;
};

const FieldScene = ({
  replay,
  currentTime,
  selectedPlayerId,
  zoom,
}: {
  replay: NormalizedReplay;
  currentTime: number;
  selectedPlayerId: string | null;
  zoom: number;
}) => {
  const frame = useMemo(() => getInterpolatedFrameAtTime(replay, currentTime), [currentTime, replay]);
  const activeEvent = useMemo(
    () =>
      replay.timeline.find(
        (event) => Math.abs(event.time - currentTime) <= 0.35 && ['goal', 'demo', 'boost', 'shot'].includes(event.type),
      ),
    [currentTime, replay.timeline],
  );
  const playerById = useMemo(
    () => Object.fromEntries(replay.players.map((player) => [player.id, player])),
    [replay.players],
  );

  const highlightColor = useMemo(() => {
    const byType: Record<ReplayEventType | 'default', string> = {
      default: '#4da3ff',
      goal: '#d4a017',
      shot: '#22e6a8',
      save: '#4da3ff',
      demo: '#b06cff',
      bump: '#4da3ff',
      boost: '#22e6a8',
      touch: '#4da3ff',
      kickoff: '#4da3ff',
      possession: '#4da3ff',
      pressure: '#4da3ff',
      aerial: '#4da3ff',
    };
    return new Color(byType[activeEvent?.type ?? 'default']);
  }, [activeEvent]);

  if (!frame) {
    return null;
  }

  const ballPosition = vec(frame.ball.position.x, frame.ball.position.y, frame.ball.position.z);
  const ballVelocity = vec(frame.ball.velocity.x, frame.ball.velocity.y, frame.ball.velocity.z);
  const fieldWidth = FIELD_DIMENSIONS.halfWidth * 2 * SCALE;
  const fieldLength = FIELD_DIMENSIONS.halfLength * 2 * SCALE;

  return (
    <>
      <color attach="background" args={['#040607']} />
      <fog attach="fog" args={['#040607', 7.5, 24]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#c6d0da', '#050607', 0.58]} />
      <spotLight position={[0, 7.5, 0]} intensity={1.25} angle={0.46} penumbra={0.7} castShadow />
      <directionalLight position={[5, 7, -4]} intensity={0.92} castShadow />

      <ArenaShell />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[fieldWidth, fieldLength]} />
        <meshStandardMaterial color="#0f1418" roughness={0.88} metalness={0.06} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0018, fieldLength * 0.25]}>
        <planeGeometry args={[fieldWidth, fieldLength * 0.5]} />
        <meshBasicMaterial color="#4da3ff" transparent opacity={0.06} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0018, -fieldLength * 0.25]}>
        <planeGeometry args={[fieldWidth, fieldLength * 0.5]} />
        <meshBasicMaterial color="#d4a017" transparent opacity={0.06} />
      </mesh>

      {[-0.7, -0.42, -0.14, 0.14, 0.42, 0.7].map((offset, index) => (
        <mesh key={offset} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001 + index * 0.0002, offset * fieldLength * 0.5]}>
          <planeGeometry args={[fieldWidth * 0.98, fieldLength * 0.11]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#11171d' : '#0d1318'} transparent opacity={0.86} />
        </mesh>
      ))}

      <FieldMarkings />

      {BOOST_PAD_POSITIONS.map((pad, index) => (
        <BoostPad key={index} x={pad.x} y={pad.y} z={pad.z} isLarge={index < 6} />
      ))}

      <GoalFrame side="blue" />
      <GoalFrame side="orange" />

      <BallProxy position={ballPosition} activeColor={highlightColor} highlighted={Boolean(activeEvent)} />

      {frame.cars.map((car) => (
        <CarProxy
          key={car.playerId}
          car={car}
          player={playerById[car.playerId]}
          selected={selectedPlayerId === car.playerId}
        />
      ))}

      <BallFollowCamera ballPosition={ballPosition} ballVelocity={ballVelocity} zoom={zoom} />
    </>
  );
};

interface ReplayViewerProps {
  replay: NormalizedReplay;
  currentTime: number;
  selectedPlayerId: string | null;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackSpeed: (speed: number) => void;
  playbackSpeed: number;
}

export const ReplayViewer3D = ({
  replay,
  currentTime,
  selectedPlayerId,
  isPlaying,
  onTogglePlayback,
  onSeek,
  onSetPlaybackSpeed,
  playbackSpeed,
}: ReplayViewerProps) => {
  const [zoom, setZoom] = useState(58);
  const playbackSpeedIndex = PLAYBACK_SPEEDS.findIndex((speed) => speed === playbackSpeed);
  const currentSpeedIndex = playbackSpeedIndex === -1 ? 1 : playbackSpeedIndex;

  const cyclePlaybackSpeed = () => {
    const nextSpeed = PLAYBACK_SPEEDS[(currentSpeedIndex + 1) % PLAYBACK_SPEEDS.length];
    onSetPlaybackSpeed(nextSpeed);
  };

  const playbackProgress = replay.meta.durationSeconds > 0 ? (currentTime / replay.meta.durationSeconds) * 100 : 0;

  return (
    <Panel title="3D Replay Viewer" subtitle={formatClock(currentTime)} className="viewer-panel">
      <div className="viewer-toolbar viewer-toolbar--stacked">
        <label className="viewer-zoom">
          <span>Zoom</span>
          <input
            className="slider slider--viewer"
            style={{ ['--range-progress' as string]: `${zoom}%` }}
            type="range"
            min={0}
            max={100}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <button type="button" className="secondary-button viewer-speed-button" onClick={cyclePlaybackSpeed}>
          Speed {playbackSpeed}x
        </button>
      </div>

      <div className="viewer-stage">
        <Canvas camera={{ position: [0, 4.2, -7.8], fov: 56 }} shadows dpr={[1, 1.8]}>
          <FieldScene replay={replay} currentTime={currentTime} selectedPlayerId={selectedPlayerId} zoom={zoom} />
        </Canvas>
      </div>

      <div className="viewer-controls viewer-controls--compact">
        <button
          type="button"
          className="primary-button viewer-controls__play"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
        >
          {isPlaying ? '\u275A\u275A' : '\u25B6'}
        </button>
        <input
          className="slider slider--timeline"
          style={{ ['--range-progress' as string]: `${playbackProgress}%` }}
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
