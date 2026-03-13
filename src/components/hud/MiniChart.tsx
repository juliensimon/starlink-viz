'use client';

import { useMemo } from 'react';

interface MiniChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
}

export default function MiniChart({
  data,
  width = 160,
  height = 40,
  color = '#00ffff',
  fillColor,
}: MiniChartProps) {
  const { linePath, areaPath } = useMemo(() => {
    if (data.length === 0) {
      return { linePath: '', areaPath: '' };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = range * 0.1;
    const yMin = min - padding;
    const yMax = max + padding;
    const yRange = yMax - yMin;

    const points = data.map((value, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * width;
      const y = height - ((value - yMin) / yRange) * height;
      return { x, y };
    });

    const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPoints = `0,${height} ${linePoints} ${width},${height}`;

    return { linePath: linePoints, areaPath: areaPoints };
  }, [data, width, height]);

  if (data.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.3}
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height}>
      {fillColor && (
        <>
          <defs>
            <linearGradient id={`fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon
            points={areaPath}
            fill={`url(#fill-${color.replace('#', '')})`}
          />
        </>
      )}
      <polyline
        points={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
