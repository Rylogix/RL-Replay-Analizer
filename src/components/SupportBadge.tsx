import type { SupportLevel } from '../types/replay';

export const SupportBadge = ({ level }: { level: SupportLevel }) => (
  <span className={`support-badge support-badge--${level}`}>{level}</span>
);

