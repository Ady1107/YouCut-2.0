import React, { useMemo } from 'react';

export interface SparklineProps {
  samples: number[]; // 21 numbers (Bps)
  width?: number;
  height?: number;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  samples,
  width = 190,
  height = 54,
  className = ''
}) => {
  const points = useMemo(() => {
    const list = samples.length > 0 ? samples : new Array(21).fill(0);
    const max = Math.max(...list, 10000); // Minimum scale to avoid division by 0
    const stepX = width / (list.length - 1);

    const coords = list.map((val, idx) => {
      const x = idx * stepX;
      // Invert Y so highest speed is at top (leave 6px padding)
      const normalized = Math.min(1, Math.max(0, val / max));
      const y = height - 6 - normalized * (height - 12);
      return { x, y };
    });

    if (coords.length === 0) return { linePath: '', areaPath: '' };

    // Build SVG path
    let linePath = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      linePath += ` L ${coords[i].x} ${coords[i].y}`;
    }

    // Area path closes at the bottom
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return { linePath, areaPath };
  }, [samples, width, height]);

  return (
    <div className={`relative flex items-center justify-end overflow-hidden ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sparkline-line)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--sparkline-line)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill area below line */}
        <path
          d={points.areaPath}
          fill="url(#sparkline-gradient)"
          className="transition-all duration-300"
        />

        {/* The line itself */}
        <path
          d={points.linePath}
          fill="none"
          stroke="var(--sparkline-line)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300"
        />
      </svg>
    </div>
  );
};
