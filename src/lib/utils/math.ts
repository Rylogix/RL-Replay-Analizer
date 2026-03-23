export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const lerp = (start: number, end: number, alpha: number) =>
  start + (end - start) * alpha;

export const magnitude = (vector: { x: number; y: number; z: number }) =>
  Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);

export const normalize01 = (value: number, max: number, min = 0) => {
  if (max <= min) {
    return 0;
  }

  return clamp((value - min) / (max - min), 0, 1);
};

export const weightedAverage = (items: Array<{ value: number; weight: number }>) => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) {
    return 0;
  }

  const weighted = items.reduce((sum, item) => sum + item.value * item.weight, 0);
  return weighted / totalWeight;
};

