"use client";

// Lightweight dependency-free SVG charts for the admin dashboard.

export function BarChart({
  data,
  color = "#B22222",
  height = 160,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => (
        <div
          key={d.label}
          className="flex flex-1 flex-col items-center justify-end gap-1"
          style={{ height }}
        >
          <div
            className="w-full rounded-t-lg transition-all"
            style={{
              height: Math.max((d.value / max) * (height - 20), 4),
              background: `linear-gradient(to top, ${color}, ${color}aa)`,
            }}
            title={`${d.value}`}
          />
          <span className="text-[10px] text-neutral-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  color = "#E85D04",
}: {
  data: number[];
  color?: string;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(...grid.flat(), 1);
  const days = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
  return (
    <div className="space-y-1">
      {grid.map((row, r) => (
        <div key={r} className="flex items-center gap-1">
          <span className="w-6 text-[10px] text-neutral-400">{days[r]}</span>
          {row.map((v, c) => (
            <div
              key={c}
              className="h-4 flex-1 rounded-sm"
              style={{
                background: `rgba(178,34,34,${0.12 + (v / max) * 0.88})`,
              }}
              title={`${v} objednávok`}
            />
          ))}
        </div>
      ))}
      <div className="flex justify-between pl-7 text-[9px] text-neutral-400">
        <span>10h</span>
        <span>14h</span>
        <span>18h</span>
        <span>22h</span>
      </div>
    </div>
  );
}
