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
const FIELD_WIDTH = FIELD_DIMENSIONS.halfWidth * 2 * SCALE;
const FIELD_LENGTH = FIELD_DIMENSIONS.halfLength * 2 * SCALE;
const GOAL_WIDTH = FIELD_DIMENSIONS.goalWidth * SCALE;
const GOAL_DEPTH = FIELD_DIMENSIONS.goalDepth * SCALE * 0.84;
const CEILING_HEIGHT = FIELD_DIMENSIONS.ceiling * SCALE;

const BALL_RADIUS = 91.25 * SCALE;
const SIDE_CURVE_RADIUS = 0.76;
const BACK_CURVE_RADIUS = 0.84;
const CORNER_RADIUS = 2.18;
const WALL_HEIGHT = 1.28;
const BACKBOARD_HEIGHT = 1.74;

const CAR_LENGTH = 118.0 * SCALE;
const CAR_WIDTH = 84.2 * SCALE;
const CAR_HEIGHT = 36.2 * SCALE;

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 3, 4] as const;
const DEMO_EXPLOSION_DURATION = 0.55;
const DEMO_RESPAWN_DURATION = 3;
const DEMO_RESPAWN_FLASH_WINDOW = 0.42;
const GOAL_EXPLOSION_DURATION = 0.9;
const GOAL_RESET_DURATION = 3.2;

const teamColor = (teamId?: string) => (teamId === 'orange' ? '#d4a017' : '#4da3ff');
const vec = (x: number, y: number, z: number) => new ThreeVector3(x * SCALE, z * SCALE, y * SCALE);
const speedOf = (car: CarState) =>
  Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2 + car.velocity.z ** 2);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const spawnLayoutBySlot = [
  { x: 0, z: 2.45 },
  { x: -1.1, z: 1.72 },
  { x: 1.1, z: 1.72 },
  { x: -0.3, z: 2.92 },
  { x: 0.3, z: 2.92 },
];

const getSpawnTransform = (teamId: string, slotIndex: number) => {
  const slot = spawnLayoutBySlot[slotIndex % spawnLayoutBySlot.length] ?? spawnLayoutBySlot[0];
  const sign = teamId === 'orange' ? -1 : 1;
  return {
    position: new ThreeVector3(slot.x, CAR_HEIGHT * 0.42, sign * slot.z),
    rotation: [0, teamId === 'orange' ? 0 : Math.PI, 0] as [number, number, number],
  };
};

const EventBurst = ({
  position,
  color,
  progress,
  radius,
}: {
  position: ThreeVector3;
  color: string;
  progress: number;
  radius: number;
}) => {
  const ringScale = 0.5 + progress * 1.6;
  const columnScale = 0.7 + progress * 1.9;
  const opacity = Math.max(0, 0.95 - progress * 1.1);

  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} scale={[ringScale, 1, ringScale]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.26, radius, 32]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, radius * 0.3 * columnScale, 0]} scale={[1 + progress * 1.1, columnScale, 1 + progress * 1.1]}>
        <sphereGeometry args={[radius * 0.28, 18, 18]} />
        <meshStandardMaterial color="#f5f7fb" emissive={color} emissiveIntensity={0.95} transparent opacity={opacity * 0.75} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius * progress * 0.9, radius * 0.2, Math.sin(angle) * radius * progress * 0.9]}
            rotation={[0, angle, Math.PI / 2]}
            scale={[1, 1 + progress * 1.8, 1]}
          >
            <coneGeometry args={[radius * 0.07, radius * 0.42, 8]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} transparent opacity={opacity * 0.68} />
          </mesh>
        );
      })}
    </group>
  );
};

const FieldLine = ({
  width,
  depth,
  x = 0,
  z = 0,
  color = '#dbe3ee',
  opacity = 0.82,
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

const SideCurve = ({ side }: { side: -1 | 1 }) => {
  const segments = 10;
  const segmentLength = FIELD_LENGTH - CORNER_RADIUS * 2;

  return (
    <>
      {Array.from({ length: segments }, (_, index) => {
        const start = (index / segments) * (Math.PI / 2);
        const end = ((index + 1) / segments) * (Math.PI / 2);
        const angle = (start + end) / 2;
        const arcStep = (SIDE_CURVE_RADIUS * Math.PI) / (2 * segments) + 0.015;
        const x = side * (FIELD_WIDTH / 2 - SIDE_CURVE_RADIUS * Math.cos(angle));
        const y = SIDE_CURVE_RADIUS * Math.sin(angle);

        return (
          <mesh
            key={`${side}-${index}`}
            receiveShadow
            position={[x, y, 0]}
            rotation={[0, 0, side === 1 ? -angle : angle]}
          >
            <boxGeometry args={[arcStep, 0.02, segmentLength]} />
            <meshStandardMaterial color="#1a232b" roughness={0.74} metalness={0.08} />
          </mesh>
        );
      })}
      <mesh position={[side * (FIELD_WIDTH / 2 + 0.02), SIDE_CURVE_RADIUS + WALL_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.05, WALL_HEIGHT, FIELD_LENGTH - CORNER_RADIUS * 2]} />
        <meshPhysicalMaterial color="#10161d" roughness={0.28} metalness={0.14} transparent opacity={0.74} />
      </mesh>
    </>
  );
};

const BackCurve = ({ side }: { side: -1 | 1 }) => {
  const segments = 10;
  const goalOpeningWidth = GOAL_WIDTH + 0.58;
  const sideSectionWidth = (FIELD_WIDTH - goalOpeningWidth - CORNER_RADIUS * 2) / 2;

  return (
    <>
      {Array.from({ length: segments }, (_, index) => {
        const start = (index / segments) * (Math.PI / 2);
        const end = ((index + 1) / segments) * (Math.PI / 2);
        const angle = (start + end) / 2;
        const arcStep = (BACK_CURVE_RADIUS * Math.PI) / (2 * segments) + 0.015;
        const z = side * (FIELD_LENGTH / 2 - BACK_CURVE_RADIUS * Math.cos(angle));
        const y = BACK_CURVE_RADIUS * Math.sin(angle);

        return (
          <mesh
            key={`${side}-${index}`}
            receiveShadow
            position={[0, y, z]}
            rotation={[side === 1 ? angle : -angle, 0, 0]}
          >
            <boxGeometry args={[FIELD_WIDTH - CORNER_RADIUS * 2, 0.02, arcStep]} />
            <meshStandardMaterial color="#1a232b" roughness={0.74} metalness={0.08} />
          </mesh>
        );
      })}

      {[-1, 1].map((xSide) => (
        <mesh
          key={`${side}-${xSide}`}
          position={[
            xSide * (goalOpeningWidth / 2 + sideSectionWidth / 2),
            BACK_CURVE_RADIUS + BACKBOARD_HEIGHT / 2,
            side * (FIELD_LENGTH / 2 + 0.02),
          ]}
        >
          <boxGeometry args={[sideSectionWidth, BACKBOARD_HEIGHT, 0.05]} />
          <meshPhysicalMaterial color="#10161d" roughness={0.26} metalness={0.14} transparent opacity={0.74} />
        </mesh>
      ))}

      <mesh position={[0, BACK_CURVE_RADIUS + BACKBOARD_HEIGHT - 0.08, side * (FIELD_LENGTH / 2 + 0.02)]}>
        <boxGeometry args={[goalOpeningWidth + 0.22, 0.16, 0.05]} />
        <meshPhysicalMaterial color="#10161d" roughness={0.26} metalness={0.14} transparent opacity={0.74} />
      </mesh>
    </>
  );
};

const CornerWalls = () => {
  const corners: Array<{ x: -1 | 1; z: -1 | 1; start: number }> = [
    { x: 1, z: 1, start: Math.PI },
    { x: -1, z: 1, start: Math.PI / 2 },
    { x: -1, z: -1, start: 0 },
    { x: 1, z: -1, start: Math.PI * 1.5 },
  ];

  return (
    <>
      {corners.map((corner) => (
        <mesh
          key={`${corner.x}-${corner.z}`}
          position={[
            corner.x * (FIELD_WIDTH / 2 - CORNER_RADIUS),
            SIDE_CURVE_RADIUS + WALL_HEIGHT / 2,
            corner.z * (FIELD_LENGTH / 2 - CORNER_RADIUS),
          ]}
        >
          <cylinderGeometry args={[CORNER_RADIUS, CORNER_RADIUS, WALL_HEIGHT, 36, 1, false, corner.start, Math.PI / 2]} />
          <meshPhysicalMaterial color="#10161d" roughness={0.28} metalness={0.16} transparent opacity={0.74} />
        </mesh>
      ))}
    </>
  );
};

const ArenaShell = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.03, 0]}>
      <planeGeometry args={[FIELD_WIDTH * 1.12, FIELD_LENGTH * 1.12]} />
      <meshStandardMaterial color="#050709" roughness={1} />
    </mesh>

    <SideCurve side={1} />
    <SideCurve side={-1} />
    <BackCurve side={1} />
    <BackCurve side={-1} />
    <CornerWalls />

    <mesh position={[0, CEILING_HEIGHT + 0.12, 0]}>
      <boxGeometry args={[FIELD_WIDTH * 0.88, 0.03, FIELD_LENGTH * 0.88]} />
      <meshBasicMaterial color="#0a0f13" transparent opacity={0.16} />
    </mesh>
  </group>
);

const FieldMarkings = () => {
  const diagonalMarkers = [-0.7, -0.38, 0.38, 0.7];
  const boxWidth = 2.46;
  const boxDepth = 1.72;

  return (
    <group>
      <FieldLine width={FIELD_WIDTH} depth={0.045} />
      <FieldLine width={FIELD_WIDTH} depth={0.045} z={FIELD_LENGTH / 2 - 0.05} opacity={0.42} />
      <FieldLine width={FIELD_WIDTH} depth={0.045} z={-FIELD_LENGTH / 2 + 0.05} opacity={0.42} />
      <FieldLine width={0.045} depth={FIELD_LENGTH} x={FIELD_WIDTH / 2 - 0.05} opacity={0.42} />
      <FieldLine width={0.045} depth={FIELD_LENGTH} x={-FIELD_WIDTH / 2 + 0.05} opacity={0.42} />

      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.02, 0.03, 12, 72]} />
        <meshBasicMaterial color="#dbe3ee" transparent opacity={0.82} />
      </mesh>

      {diagonalMarkers.map((offset) => (
        <FieldLine
          key={offset}
          width={FIELD_WIDTH * 0.82}
          depth={0.018}
          z={offset * (FIELD_LENGTH / 2)}
          color="#171d24"
          opacity={0.86}
        />
      ))}

      {[1, -1].map((side) => {
        const boxCenter = side * (FIELD_LENGTH / 2 - boxDepth / 2 - 0.24);
        return (
          <group key={side}>
            <FieldLine width={boxWidth} depth={0.035} z={boxCenter - side * boxDepth / 2} opacity={0.7} />
            <FieldLine width={0.035} depth={boxDepth} x={boxWidth / 2} z={boxCenter} opacity={0.7} />
            <FieldLine width={0.035} depth={boxDepth} x={-boxWidth / 2} z={boxCenter} opacity={0.7} />
            <mesh position={[0, 0.012, boxCenter + side * 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.12, 18]} />
              <meshBasicMaterial color="#dbe3ee" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const GoalNet = ({ side }: { side: -1 | 1 }) => {
  const depth = GOAL_DEPTH;

  return (
    <group>
      {[-0.44, -0.22, 0, 0.22, 0.44].map((offset) => (
        <mesh key={`v-${offset}`} position={[offset * GOAL_WIDTH, 0.2, side * depth * 0.48]}>
          <boxGeometry args={[0.012, 0.34, 0.012]} />
          <meshStandardMaterial color="#8b98a5" transparent opacity={0.2} />
        </mesh>
      ))}
      {[0.06, 0.14, 0.22, 0.3].map((height) => (
        <mesh key={`h-${height}`} position={[0, height, side * depth * 0.48]}>
          <boxGeometry args={[GOAL_WIDTH - 0.08, 0.01, 0.01]} />
          <meshStandardMaterial color="#8b98a5" transparent opacity={0.18} />
        </mesh>
      ))}
      {[-1, 1].map((xSide) => (
        <mesh key={`side-${xSide}`} position={[xSide * (GOAL_WIDTH / 2 - 0.03), 0.18, side * depth * 0.5]}>
          <boxGeometry args={[0.012, 0.3, depth * 0.95]} />
          <meshStandardMaterial color="#8b98a5" transparent opacity={0.18} />
        </mesh>
      ))}
    </group>
  );
};

const GoalAssembly = ({ side }: { side: 'blue' | 'orange' }) => {
  const direction = side === 'blue' ? 1 : -1;
  const color = side === 'blue' ? '#4da3ff' : '#d4a017';

  return (
    <group position={[0, 0, direction * (FIELD_LENGTH / 2 + 0.01)]}>
      <mesh position={[0, 0.01, direction * GOAL_DEPTH * 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GOAL_WIDTH - 0.05, GOAL_DEPTH * 0.94]} />
        <meshStandardMaterial color="#0b1014" roughness={0.88} metalness={0.04} />
      </mesh>

      <mesh position={[0, 0.18, direction * GOAL_DEPTH * 0.93]}>
        <boxGeometry args={[GOAL_WIDTH - 0.06, 0.36, 0.03]} />
        <meshPhysicalMaterial color={color} roughness={0.22} metalness={0.1} transparent opacity={0.08} />
      </mesh>

      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[GOAL_WIDTH, 0.055, 0.055]} />
        <meshStandardMaterial color="#f3f7fb" emissive={color} emissiveIntensity={0.16} />
      </mesh>
      {[-1, 1].map((xSide) => (
        <mesh key={xSide} position={[xSide * (GOAL_WIDTH / 2 - 0.03), 0.15, 0]}>
          <boxGeometry args={[0.055, 0.36, 0.055]} />
          <meshStandardMaterial color="#f3f7fb" emissive={color} emissiveIntensity={0.12} />
        </mesh>
      ))}

      {[-1, 1].map((xSide) => (
        <mesh key={`support-${xSide}`} position={[xSide * (GOAL_WIDTH / 2 - 0.03), 0.16, direction * GOAL_DEPTH * 0.5]}>
          <boxGeometry args={[0.035, 0.32, GOAL_DEPTH]} />
          <meshStandardMaterial color="#a0acb8" transparent opacity={0.16} />
        </mesh>
      ))}

      <mesh position={[0, 0.34, direction * GOAL_DEPTH * 0.94]}>
        <boxGeometry args={[GOAL_WIDTH - 0.08, 0.025, 0.025]} />
        <meshStandardMaterial color="#a0acb8" transparent opacity={0.18} />
      </mesh>

      <GoalNet side={direction} />
    </group>
  );
};

const BoostPad = ({ x, y, z, isLarge }: { x: number; y: number; z: number; isLarge: boolean }) => {
  const position = vec(x, y, z);
  const radius = isLarge ? 0.16 : 0.09;
  const ringColor = isLarge ? '#d4a017' : '#22e6a8';
  const coreColor = isLarge ? '#f3d56e' : '#89f3cf';

  return (
    <group position={position}>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[radius + 0.032, radius + 0.04, 0.024, 24]} />
        <meshStandardMaterial color="#141a20" roughness={0.78} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0.021, 0]}>
        <cylinderGeometry args={[radius, radius, 0.014, 24]} />
        <meshStandardMaterial color="#0d1115" roughness={0.34} metalness={0.2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.029, 0]}>
        <ringGeometry args={[radius * 0.58, radius * 0.94, 28]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.94} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, Math.PI / 4, 0]}>
        <circleGeometry args={[radius * 0.26, isLarge ? 8 : 6]} />
        <meshBasicMaterial color={coreColor} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0.048, 0]}>
        <sphereGeometry args={[isLarge ? 0.03 : 0.018, 14, 14]} />
        <meshStandardMaterial color={coreColor} emissive={ringColor} emissiveIntensity={0.54} />
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
      <ringGeometry args={[0.11, 0.17, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.18} />
    </mesh>
    <mesh castShadow>
      <sphereGeometry args={[BALL_RADIUS, 28, 28]} />
      <meshStandardMaterial
        color="#eef3f8"
        metalness={0.34}
        roughness={0.2}
        emissive={activeColor}
        emissiveIntensity={highlighted ? 0.42 : 0.06}
      />
    </mesh>
    {[0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].map((rotation) => (
      <mesh key={rotation} rotation={[Math.PI / 2, 0, rotation]}>
        <torusGeometry args={[BALL_RADIUS * 0.68, 0.01, 10, 24]} />
        <meshStandardMaterial color="#77818e" metalness={0.42} roughness={0.28} />
      </mesh>
    ))}
  </group>
);

const BoostTrail = ({ visible }: { visible: boolean }) =>
  visible ? (
    <group position={[0, 0.005, -CAR_LENGTH * 0.54]}>
      {[-CAR_WIDTH * 0.18, CAR_WIDTH * 0.18].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.028, 0.15, 10]} />
            <meshStandardMaterial color="#eff6ff" emissive="#22e6a8" emissiveIntensity={0.76} transparent opacity={0.84} />
          </mesh>
          <mesh position={[0, 0, -0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.018, 0.1, 8]} />
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
  overridePosition,
  overrideRotation,
  hidden,
  respawning,
}: {
  car: CarState;
  player?: Player;
  selected: boolean;
  overridePosition?: ThreeVector3;
  overrideRotation?: [number, number, number];
  hidden?: boolean;
  respawning?: boolean;
}) => {
  const bodyColor = teamColor(player?.teamId);
  const position = overridePosition ?? vec(car.position.x, car.position.y, car.position.z + 18);
  const rotation: [number, number, number] =
    overrideRotation ?? [car.rotation.x * 0.1, -car.rotation.y, car.rotation.z * 0.1];
  const boosting = car.boost > 4 && (speedOf(car) > 1450 || Boolean(car.supersonic));
  const labelClass =
    player?.teamId === 'orange' ? 'viewer-label viewer-label--orange' : 'viewer-label viewer-label--blue';

  if (hidden) {
    return null;
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, -0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CAR_WIDTH * 0.8, CAR_WIDTH * 1.08, 18]} />
        <meshBasicMaterial color={selected ? '#f3f4f6' : bodyColor} transparent opacity={selected ? 0.22 : 0.08} />
      </mesh>

      <mesh castShadow position={[0, 0.018, -0.004]}>
        <boxGeometry args={[CAR_WIDTH * 0.92, CAR_HEIGHT * 0.82, CAR_LENGTH * 0.86]} />
        <meshStandardMaterial color={bodyColor} metalness={0.28} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, 0.055, -0.012]}>
        <boxGeometry args={[CAR_WIDTH * 0.58, CAR_HEIGHT * 0.52, CAR_LENGTH * 0.34]} />
        <meshStandardMaterial color={bodyColor} metalness={0.26} roughness={0.24} />
      </mesh>
      <mesh castShadow position={[0, 0.035, CAR_LENGTH * 0.34]} rotation={[0.74, 0, 0]}>
        <boxGeometry args={[CAR_WIDTH * 0.72, CAR_HEIGHT * 0.56, CAR_LENGTH * 0.16]} />
        <meshStandardMaterial color={bodyColor} metalness={0.24} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0.07, CAR_LENGTH * 0.08]} rotation={[-0.62, 0, 0]}>
        <boxGeometry args={[CAR_WIDTH * 0.46, CAR_HEIGHT * 0.18, CAR_LENGTH * 0.12]} />
        <meshStandardMaterial color="#c0c9d2" metalness={0.52} roughness={0.16} />
      </mesh>
      <mesh castShadow position={[0, 0.046, -CAR_LENGTH * 0.41]}>
        <boxGeometry args={[CAR_WIDTH * 0.6, CAR_HEIGHT * 0.12, CAR_LENGTH * 0.06]} />
        <meshStandardMaterial color="#252c34" metalness={0.22} roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0, 0.08, -CAR_LENGTH * 0.36]}>
        <boxGeometry args={[CAR_WIDTH * 0.52, CAR_HEIGHT * 0.05, CAR_LENGTH * 0.04]} />
        <meshStandardMaterial color="#1d232b" metalness={0.24} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.03, CAR_LENGTH * 0.42]}>
        <boxGeometry args={[CAR_WIDTH * 0.28, CAR_HEIGHT * 0.16, CAR_LENGTH * 0.022]} />
        <meshStandardMaterial color="#f8fbff" emissive="#f8fbff" emissiveIntensity={0.12} />
      </mesh>
      {[-1, 1].map((xSide) => (
        <mesh key={`tail-${xSide}`} position={[xSide * CAR_WIDTH * 0.2, 0.018, -CAR_LENGTH * 0.46]}>
          <boxGeometry args={[CAR_WIDTH * 0.12, CAR_HEIGHT * 0.1, CAR_LENGTH * 0.02]} />
          <meshStandardMaterial color="#ff9d88" emissive="#ff7c5a" emissiveIntensity={0.16} />
        </mesh>
      ))}

      {[
        [-CAR_WIDTH * 0.38, -CAR_HEIGHT * 0.42, -CAR_LENGTH * 0.26],
        [CAR_WIDTH * 0.38, -CAR_HEIGHT * 0.42, -CAR_LENGTH * 0.26],
        [-CAR_WIDTH * 0.38, -CAR_HEIGHT * 0.42, CAR_LENGTH * 0.24],
        [CAR_WIDTH * 0.38, -CAR_HEIGHT * 0.42, CAR_LENGTH * 0.24],
      ].map(([x, y, z], index) => (
        <group key={index} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[CAR_HEIGHT * 0.34, CAR_HEIGHT * 0.34, CAR_WIDTH * 0.16, 16]} />
            <meshStandardMaterial color="#090b0d" roughness={0.82} />
          </mesh>
          <mesh scale={0.66}>
            <cylinderGeometry args={[CAR_HEIGHT * 0.34, CAR_HEIGHT * 0.34, CAR_WIDTH * 0.18, 14]} />
            <meshStandardMaterial color="#8391a0" metalness={0.68} roughness={0.28} />
          </mesh>
        </group>
      ))}

      <BoostTrail visible={boosting} />

      {respawning ? (
        <mesh position={[0, CAR_HEIGHT * 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[CAR_WIDTH * 0.48, CAR_WIDTH * 0.72, 20]} />
          <meshBasicMaterial color="#f3f4f6" transparent opacity={0.7} />
        </mesh>
      ) : null}

      <Html position={[0, 0.24, 0]} center distanceFactor={12}>
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

    const distance = 2.2 + ((100 - zoom) / 100) * 5.2;
    const height = 1.1 + ((100 - zoom) / 100) * 2.8;
    const sideBias = MathUtils.lerp(0.22, 0.04, zoom / 100);

    const desired = ballPosition
      .clone()
      .add(directionRef.current.clone().multiplyScalar(-distance))
      .add(new ThreeVector3(sideBias, height, 0));

    targetRef.current.lerp(ballPosition.clone().add(new ThreeVector3(0, 0.2, 0)), 0.12);
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
  const teamPlayers = useMemo(
    () => ({
      blue: replay.players.filter((player) => player.teamId === 'blue'),
      orange: replay.players.filter((player) => player.teamId === 'orange'),
    }),
    [replay.players],
  );
  const activeEvent = useMemo(
    () =>
      replay.timeline.find(
        (event) => Math.abs(event.time - currentTime) <= 0.35 && ['goal', 'demo', 'shot'].includes(event.type),
      ),
    [currentTime, replay.timeline],
  );
  const playerById = useMemo(
    () => Object.fromEntries(replay.players.map((player) => [player.id, player])),
    [replay.players],
  );
  const activeGoal = useMemo(
    () => replay.goals.find((goal) => currentTime >= goal.time && currentTime <= goal.time + GOAL_RESET_DURATION) ?? null,
    [currentTime, replay.goals],
  );
  const activeDemos = useMemo(
    () =>
      replay.demos.filter(
        (demo) => currentTime >= demo.time && currentTime <= demo.time + DEMO_RESPAWN_DURATION,
      ),
    [currentTime, replay.demos],
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

  const goalResetProgress = activeGoal ? clamp01((currentTime - activeGoal.time) / GOAL_RESET_DURATION) : 0;
  const goalExplosionProgress = activeGoal ? clamp01((currentTime - activeGoal.time) / GOAL_EXPLOSION_DURATION) : 0;

  const goalExplosionPosition = activeGoal
    ? new ThreeVector3(0, 0.25, activeGoal.teamId === 'blue' ? -FIELD_LENGTH / 2 + 0.36 : FIELD_LENGTH / 2 - 0.36)
    : null;

  const ballPosition =
    activeGoal && currentTime >= activeGoal.time + GOAL_EXPLOSION_DURATION * 0.45
      ? new ThreeVector3(0, BALL_RADIUS, 0)
      : vec(frame.ball.position.x, frame.ball.position.y, frame.ball.position.z);
  const ballVelocity =
    activeGoal && currentTime >= activeGoal.time + GOAL_EXPLOSION_DURATION * 0.45
      ? new ThreeVector3(0, 0, 0)
      : vec(frame.ball.velocity.x, frame.ball.velocity.y, frame.ball.velocity.z);

  const demoVictimStates = new Map(
    activeDemos.map((demo) => {
      const player = playerById[demo.victimId];
      const teamRoster = teamPlayers[player?.teamId === 'orange' ? 'orange' : 'blue'];
      const slotIndex = Math.max(
        0,
        teamRoster.findIndex((entry) => entry.id === demo.victimId),
      );
      const spawn = getSpawnTransform(player?.teamId ?? 'blue', slotIndex);
      const elapsed = currentTime - demo.time;
      return [
        demo.victimId,
        {
          hidden: elapsed < DEMO_RESPAWN_DURATION - DEMO_RESPAWN_FLASH_WINDOW,
          respawning: elapsed >= DEMO_RESPAWN_DURATION - DEMO_RESPAWN_FLASH_WINDOW,
          spawn,
        },
      ];
    }),
  );

  const renderedCars = frame.cars.map((car) => {
    const player = playerById[car.playerId];
    const teamRoster = teamPlayers[player?.teamId === 'orange' ? 'orange' : 'blue'];
    const slotIndex = Math.max(
      0,
      teamRoster.findIndex((entry) => entry.id === car.playerId),
    );
    const goalSpawn = player ? getSpawnTransform(player.teamId, slotIndex) : null;
    const demoState = demoVictimStates.get(car.playerId);
    const useGoalSpawn = activeGoal !== null && currentTime >= activeGoal.time + GOAL_EXPLOSION_DURATION * 0.45;

    return (
      <CarProxy
        key={car.playerId}
        car={car}
        player={player}
        selected={selectedPlayerId === car.playerId}
        overridePosition={
          demoState?.respawning
            ? demoState.spawn.position
            : useGoalSpawn && goalSpawn
              ? goalSpawn.position
              : undefined
        }
        overrideRotation={
          demoState?.respawning
            ? demoState.spawn.rotation
            : useGoalSpawn && goalSpawn
              ? goalSpawn.rotation
              : undefined
        }
        hidden={Boolean(demoState?.hidden)}
        respawning={Boolean(demoState?.respawning) || (useGoalSpawn && goalResetProgress > 0.2)}
      />
    );
  });

  return (
    <>
      <color attach="background" args={['#040607']} />
      <fog attach="fog" args={['#040607', 7.5, 24]} />
      <ambientLight intensity={0.58} />
      <hemisphereLight args={['#c9d2dc', '#050607', 0.58]} />
      <spotLight position={[0, 7.5, 0]} intensity={1.2} angle={0.48} penumbra={0.72} castShadow />
      <directionalLight position={[5, 7, -4]} intensity={0.88} castShadow />

      <ArenaShell />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_WIDTH, FIELD_LENGTH]} />
        <meshStandardMaterial color="#11161b" roughness={0.88} metalness={0.04} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0018, FIELD_LENGTH * 0.25]}>
        <planeGeometry args={[FIELD_WIDTH, FIELD_LENGTH * 0.5]} />
        <meshBasicMaterial color="#4da3ff" transparent opacity={0.055} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0018, -FIELD_LENGTH * 0.25]}>
        <planeGeometry args={[FIELD_WIDTH, FIELD_LENGTH * 0.5]} />
        <meshBasicMaterial color="#d4a017" transparent opacity={0.055} />
      </mesh>

      {[-0.72, -0.44, -0.16, 0.16, 0.44, 0.72].map((offset, index) => (
        <mesh key={offset} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001 + index * 0.0002, offset * FIELD_LENGTH * 0.5]}>
          <planeGeometry args={[FIELD_WIDTH * 0.98, FIELD_LENGTH * 0.1]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#11171d' : '#0d1318'} transparent opacity={0.84} />
        </mesh>
      ))}

      <FieldMarkings />

      {BOOST_PAD_POSITIONS.map((pad, index) => (
        <BoostPad key={index} x={pad.x} y={pad.y} z={pad.z} isLarge={index < 6} />
      ))}

      <GoalAssembly side="blue" />
      <GoalAssembly side="orange" />

      <BallProxy position={ballPosition} activeColor={highlightColor} highlighted={Boolean(activeEvent)} />

      {activeGoal && goalExplosionPosition && currentTime <= activeGoal.time + GOAL_EXPLOSION_DURATION ? (
        <EventBurst
          position={goalExplosionPosition}
          color={activeGoal.teamId === 'blue' ? '#d4a017' : '#4da3ff'}
          progress={goalExplosionProgress}
          radius={0.95}
        />
      ) : null}

      {activeDemos.map((demo) => {
        const elapsed = currentTime - demo.time;
        if (elapsed > DEMO_EXPLOSION_DURATION) {
          return null;
        }

        return (
          <EventBurst
            key={demo.id}
            position={vec(demo.position.x, demo.position.y, demo.position.z + 24)}
            color="#b06cff"
            progress={clamp01(elapsed / DEMO_EXPLOSION_DURATION)}
            radius={0.56}
          />
        );
      })}

      {renderedCars}

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
        <Canvas camera={{ position: [0, 4.4, -8.1], fov: 56 }} shadows dpr={[1, 1.8]}>
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
