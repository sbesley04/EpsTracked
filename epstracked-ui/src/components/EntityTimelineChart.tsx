"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EntityTimelineChartProps {
  data: { year: string; total: number; flagged: number }[];
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 8,
    color: "#e4e4ef",
    fontSize: 12,
  },
};

export default function EntityTimelineChart({ data }: EntityTimelineChartProps) {
  if (!data.length) {
    return (
      <p className="text-xs" style={{ color: "#9999b5" }}>
        No dated events available for this entity.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis
            dataKey="year"
            tick={{ fill: "#9999b5", fontSize: 11 }}
            axisLine={{ stroke: "#2a2a3e" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9999b5", fontSize: 11 }}
            axisLine={{ stroke: "#2a2a3e" }}
            tickLine={false}
          />
          <Tooltip {...TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="total"
            stackId="1"
            stroke="#6366f1"
            fill="#6366f140"
            name="Total"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="flagged"
            stackId="2"
            stroke="#ef4444"
            fill="#ef444440"
            name="Flagged"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
