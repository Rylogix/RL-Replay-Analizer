import { useEffect, useRef, useState } from 'react';
import { FIELD_DIMENSIONS } from '../../lib/utils/field';
import { Panel } from '../../components/Panel';
import type { NormalizedReplay, Vector3 } from '../../types/replay';

const toCanvas = (position: Vector3, width: number, height: number) => ({
  x: ((position.x + FIELD_DIMENSIONS.halfWidth) / (FIELD_DIMENSIONS.halfWidth * 2)) * width,
  y: height - ((position.y + FIELD_DIMENSIONS.halfLength) / (FIELD_DIMENSIONS.halfLength * 2)) * height
});

const HeatmapCanvas = ({
  title,
  points,
  color
}: {
  title: string;
  points: Vector3[];
  color: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#0b1620';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#214055';
    context.lineWidth = 2;
    context.strokeRect(2, 2, width - 4, height - 4);
    context.beginPath();
    context.moveTo(width / 2, 0);
    context.lineTo(width / 2, height);
    context.stroke();

    const grid = Array.from({ length: 24 }, () => Array.from({ length: 16 }, () => 0));
    points.forEach((point) => {
      const mapped = toCanvas(point, width, height);
      const gridX = Math.max(0, Math.min(23, Math.floor((mapped.x / width) * 24)));
      const gridY = Math.max(0, Math.min(15, Math.floor((mapped.y / height) * 16)));
      grid[gridX][gridY] += 1;
    });

    const maxCount = Math.max(1, ...grid.flat());
    for (let x = 0; x < 24; x += 1) {
      for (let y = 0; y < 16; y += 1) {
        const intensity = grid[x][y] / maxCount;
        if (!intensity) {
          continue;
        }
        context.fillStyle = `${color}${Math.round(Math.min(0.88, intensity) * 255)
          .toString(16)
          .padStart(2, '0')}`;
        context.fillRect((width / 24) * x, (height / 16) * y, width / 24, height / 16);
      }
    }
  }, [color, points]);

  return (
    <article className="heatmap-card">
      <div className="heatmap-card__header">
        <h3>{title}</h3>
        <span>{points.length} samples</span>
      </div>
      <canvas ref={canvasRef} width={460} height={280} />
    </article>
  );
};

export const HeatmapPanel = ({
  replay,
  selectedPlayerId,
  onSelectPlayer
}: {
  replay: NormalizedReplay;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
}) => {
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(replay.meta.durationSeconds);

  useEffect(() => {
    setRangeStart(0);
    setRangeEnd(replay.meta.durationSeconds);
  }, [replay.meta.durationSeconds]);

  const activePlayerId = selectedPlayerId ?? replay.players[0]?.id;
  const filteredFrames = replay.frames.filter((frame) => frame.time >= rangeStart && frame.time <= rangeEnd);
  const playerPositions = filteredFrames.flatMap((frame) => {
    const car = frame.cars.find((entry) => entry.playerId === activePlayerId);
    return car ? [car.position] : [];
  });
  const touchPoints = replay.touches
    .filter((touch) => touch.playerId === activePlayerId && touch.time >= rangeStart && touch.time <= rangeEnd)
    .map((touch) => touch.position);
  const boostPoints = replay.boostPickups
    .filter((pickup) => pickup.playerId === activePlayerId && pickup.time >= rangeStart && pickup.time <= rangeEnd)
    .map((pickup) => pickup.position);
  const pressurePoints = replay.pressureWindows
    .filter((window) => window.startTime <= rangeEnd && window.endTime >= rangeStart)
    .flatMap((window) =>
      replay.frames
        .filter((frame) => frame.time >= window.startTime && frame.time <= window.endTime)
        .map((frame) => frame.ball.position),
    );

  return (
    <Panel title="Heatmaps" subtitle="Top-down client-side density maps">
      <div className="heatmap-toolbar">
        <select value={activePlayerId} onChange={(event) => onSelectPlayer(event.target.value)}>
          {replay.players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <label>
          Start
          <input
            type="range"
            min={0}
            max={replay.meta.durationSeconds}
            step={1}
            value={rangeStart}
            onChange={(event) => setRangeStart(Math.min(Number(event.target.value), rangeEnd - 1))}
          />
        </label>
        <label>
          End
          <input
            type="range"
            min={0}
            max={replay.meta.durationSeconds}
            step={1}
            value={rangeEnd}
            onChange={(event) => setRangeEnd(Math.max(Number(event.target.value), rangeStart + 1))}
          />
        </label>
      </div>
      <div className="heatmap-grid">
        <HeatmapCanvas title="Player Position Heatmap" points={playerPositions} color="#31c4bf" />
        <HeatmapCanvas title="Ball Touch Heatmap" points={touchPoints} color="#ff9c53" />
        <HeatmapCanvas title="Boost Collection Heatmap" points={boostPoints} color="#9fe870" />
        <HeatmapCanvas title="Pressure Heatmap" points={pressurePoints} color="#ff5f87" />
      </div>
    </Panel>
  );
};

