import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, Vector3 as ThreeVector3 } from 'three';
import { getInterpolatedFrameAtTime } from '../../lib/analytics/selectors';
import { BOOST_PAD_POSITIONS, FIELD_DIMENSIONS } from '../../lib/utils/field';
import { Panel } from '../../components/Panel';
import { formatClock } from '../../lib/utils/format';
import type { CarState, NormalizedReplay, Player, ReplayEventType } from '../../types/replay';

const SCALE = 0.0018;
const BALL_RADIUS = 0.19;

const teamColor = (teamId?: string) => (teamId === 'orange' ? '#d4a017' : '#4da3ff');
const vec = (x: number, y: number, z: number) => new ThreeVector3(x * SCALE, z * SCALE, y * SCALE);
const speedOf = (car: CarState) =>
  Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2 + car.velocity.z ** 2);

const GoalFrame = ({ side }: { side: 'blue' | 'orange' }) => {
  const direction = side === 'blue' ? 1 : -1;
  const color = side === 'blue' ? '#4da3ff' : '#d4a017';
  const goalY = direction * (FIELD_DIMENSIONS.halfLength * SCALE + 0.62);
  const width = FIELD_DIMENSIONS.goalWidth * SCALE;

  return (
    <group position={[0, 0.36, goalY]}>
      <mesh position={[0, 0.24, 0]}>
        <boxGeometry args={[width, 0.05, 0.05]} />
        <meshStandardMaterial color="#edf4fb" emissive={color} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[-width / 2 + 0.03, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.28, 0.05]} />
        <meshStandardMaterial color="#edf4fb" emissive={color} emissiveIntensity={0.14} />
      </mesh>
      <mesh position={[width / 2 - 0.03, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.28, 0.05]} />
        <meshStandardMaterial color="#edf4fb" emissive={color} emissiveIntensity={0.14} />
      </mesh>
      <mesh position={[0, 0.1, direction * 0.34]}>
        <boxGeometry args={[width - 0.08, 0.2, 0.03]} />
        <meshStandardMaterial color={color} transparent opacity={0.12} />
      </mesh>
    </group>
  );
};

const BoostPad = ({ x, y, z, isLarge }: { x: number; y: number; z: number; isLarge: boolean }) => {
  const position = vec(x, y, z);
  const radius = isLarge ? 0.14 : 0.08;

  return (
    <group position={position}>
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[radius + 0.02, radius + 0.03, 0.02, 18]} />
        <meshStandardMaterial color="#171b20" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.68, radius, 22]} />
        <meshBasicMaterial color={isLarge ? '#d4a017' : '#22e6a8'} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[isLarge ? 0.026 : 0.018, 12, 12]} />
        <meshStandardMaterial
          color={isLarge ? '#f5d56f' : '#9af6d9'}
          emissive={isLarge ? '#d4a017' : '#22e6a8'}
          emissiveIntensity={0.42}
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
      <ringGeometry args={[0.1, 0.16, 28]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.2} />
    </mesh>
    <mesh>
      <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
      <meshStandardMaterial color="#eff3f7" metalness={0.26} roughness={0.24} emissive={activeColor} emissiveIntensity={highlighted ? 0.55 : 0.1} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[BALL_RADIUS * 0.68, 0.012, 10, 22]} />
      <meshStandardMaterial color="#838c98" metalness={0.35} roughness={0.32} />
    </mesh>
    <mesh rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[BALL_RADIUS * 0.68, 0.012, 10, 22]} />
      <meshStandardMaterial color="#838c98" metalness={0.35} roughness={0.32} />
    </mesh>
  </group>
);

const BoostTrail = ({ visible }: { visible: boolean }) =>
  visible ? (
    <group position={[0, 0.02, -0.42]}>
      {[-0.06, 0.06].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.22, 10]} />
            <meshStandardMaterial color="#f0f2f4" emissive="#22e6a8" emissiveIntensity={0.65} transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.028, 0.16, 8]} />
            <meshStandardMaterial color="#4da3ff" emissive="#4da3ff" emissiveIntensity={0.55} transparent opacity={0.72} />
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
        <ringGeometry args={[0.18, 0.26, 20]} />
        <meshBasicMaterial color={selected ? '#f3f4f6' : bodyColor} transparent opacity={selected ? 0.28 : 0.12} />
      </mesh>
      <mesh castShadow position={[0, 0.015, -0.03]}>
        <boxGeometry args={[0.48, 0.1, 0.7]} />
        <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.32} emissive={selected ? '#f3f4f6' : '#000000'} emissiveIntensity={selected ? 0.1 : 0} />
      </mesh>
      <mesh castShadow position={[0, 0.095, -0.03]}>
        <boxGeometry args={[0.24, 0.08, 0.28]} />
        <meshStandardMaterial color="#d9dde3" metalness={0.18} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, 0.035, 0.29]} rotation={[0.72, 0, 0]}>
        <boxGeometry args={[0.32, 0.12, 0.18]} />
        <meshStandardMaterial color={bodyColor} metalness={0.24} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0.05, -0.33]}>
        <boxGeometry args={[0.34, 0.06, 0.1]} />
        <meshStandardMaterial color="#14181d" roughness={0.78} />
      </mesh>
      <mesh castShadow position={[0, 0.12, -0.26]}>
        <boxGeometry args={[0.28, 0.02, 0.08]} />
        <meshStandardMaterial color="#2b3137" />
      </mesh>
      <mesh position={[0, 0.075, 0.18]}>
        <boxGeometry args={[0.18, 0.025, 0.03]} />
        <meshStandardMaterial color="#f3f4f6" emissive="#f3f4f6" emissiveIntensity={0.08} />
      </mesh>
      {[
        [-0.18, -0.06, -0.19],
        [0.18, -0.06, -0.19],
        [-0.18, -0.06, 0.18],
        [0.18, -0.06, 0.18],
      ].map(([x, y, z], index) => (
        <mesh key={index} castShadow position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#090b0d" roughness={0.78} />
        </mesh>
      ))}
      <BoostTrail visible={boosting} />
      <Html position={[0, 0.38, 0]} center distanceFactor={12}>
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
  const directionRef = useRef(new ThreeVector3(0.18, 0, 1));

  useFrame(() => {
    const planarVelocity = ballVelocity.clone();
    planarVelocity.y = 0;
    if (planarVelocity.lengthSq() > 0.0001) {
      directionRef.current.copy(planarVelocity.normalize());
    }

    const distance = 1.6 + ((100 - zoom) / 100) * 5.2;
    const height = 1.15 + ((100 - zoom) / 100) * 2.8;
    const desired = ballPosition
      .clone()
      .add(directionRef.current.clone().multiplyScalar(-distance))
      .add(new ThreeVector3(0, height, 0));

    camera.position.lerp(desired, 0.08);
    camera.lookAt(ballPosition.clone().add(new ThreeVector3(0, 0.2, 0)));
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

  return (
    <>
      <color attach="background" args={['#050607']} />
      <fog attach="fog" args={['#050607', 7, 22]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#9ba3af', '#050607', 0.4]} />
      <directionalLight position={[4, 8, -2]} intensity={1.1} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.03, 0]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2.14 * SCALE, FIELD_DIMENSIONS.halfLength * 2.14 * SCALE]} />
        <meshStandardMaterial color="#050607" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, FIELD_DIMENSIONS.halfLength * 2 * SCALE]} />
        <meshStandardMaterial color="#111418" roughness={0.9} metalness={0.04} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, FIELD_DIMENSIONS.halfLength * SCALE * 0.5]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, FIELD_DIMENSIONS.halfLength * SCALE]} />
        <meshBasicMaterial color="#4da3ff" transparent opacity={0.06} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -FIELD_DIMENSIONS.halfLength * SCALE * 0.5]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, FIELD_DIMENSIONS.halfLength * SCALE]} />
        <meshBasicMaterial color="#d4a017" transparent opacity={0.06} />
      </mesh>

      {[-0.68, -0.34, 0, 0.34, 0.68].map((offset, index) => (
        <mesh
          key={index}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.003 + index * 0.0005, offset * FIELD_DIMENSIONS.halfLength * SCALE]}
        >
          <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 1.94 * SCALE, FIELD_DIMENSIONS.halfLength * 0.24 * SCALE]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#0d1013' : '#12161a'} transparent opacity={0.9} />
        </mesh>
      ))}

      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.02, 2.15, 56]} />
        <meshBasicMaterial color="#2b3138" transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_DIMENSIONS.halfWidth * 2 * SCALE, 0.03]} />
        <meshBasicMaterial color="#2b3138" transparent opacity={0.92} />
      </mesh>

      {BOOST_PAD_POSITIONS.map((pad, index) => (
        <BoostPad key={index} x={pad.x} y={pad.y} z={pad.z} isLarge={index < 6} />
      ))}

      <GoalFrame side="blue" />
      <GoalFrame side="orange" />

      <BallProxy position={ballPosition} activeColor={highlightColor} highlighted={Boolean(activeEvent)} />

      {frame.cars.map((car) => {
        const player = replay.players.find((entry) => entry.id === car.playerId);
        return <CarProxy key={car.playerId} car={car} player={player} selected={selectedPlayerId === car.playerId} />;
      })}

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

  return (
    <Panel
      title="3D Replay Viewer"
      subtitle={`Ball-follow replay viewport at ${formatClock(currentTime)}`}
      className="viewer-panel"
    >
      <div className="viewer-toolbar viewer-toolbar--stacked">
        <label className="viewer-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={0}
            max={100}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <label className="viewer-speed-select">
          <span>Speed</span>
          <select value={playbackSpeed} onChange={(event) => onSetPlaybackSpeed(Number(event.target.value))}>
            {[0.5, 1, 1.5, 2].map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="viewer-stage">
        <Canvas camera={{ position: [0, 4.5, -6.5], fov: 44 }} shadows>
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
