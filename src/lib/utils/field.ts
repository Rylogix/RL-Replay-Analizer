import type { Vector3 } from '../../types/replay';

export const FIELD_DIMENSIONS = {
  halfWidth: 4096,
  halfLength: 5120,
  ceiling: 2044,
  goalWidth: 1786,
  goalDepth: 880,
};

export const BOOST_PAD_POSITIONS: Vector3[] = [
  { x: -3072, y: -4096, z: 0 },
  { x: 3072, y: -4096, z: 0 },
  { x: -3072, y: 4096, z: 0 },
  { x: 3072, y: 4096, z: 0 },
  { x: 0, y: -2816, z: 0 },
  { x: 0, y: 2816, z: 0 },
  { x: -3584, y: 0, z: 0 },
  { x: 3584, y: 0, z: 0 },
];

