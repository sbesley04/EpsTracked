"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface DashboardChartsProps {
  eventTypeData: { name: string; value: number; color: string }[];
  likelihoodData: { range: string; count: number }[];
  timelineData: { year: string; total: number; flagged: number }[];
}

const CARD_STYLE = {
  background: "#1a1a2e",
  borderColor: "#2a2a3e",
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1a1a2e",
    border: "1px solid #2a2a3e",
    borderRadius: 8,
    color: "#e4e4ef",
    fontSize: 12,
  },
};

export default function DashboardCharts({
  eventTypeData,
  likelihoodData,
  timelineData,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Event Types Pie */}
      <div
        className="rounded-xl p-5 border"
        style={CARD_STYLE}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "#e4e4ef" }}
        >
          Event Types
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={eventTypeData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {eventTypeData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-3 mt-2">
          {eventTypeData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs" style={{ color: "#8888a0" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              {item.name} ({item.value})
            </div>
          ))}
        </div>
      </div>

      {/* Likelihood Distribution */}
      <div
        className="rounded-xl p-5 border"
        style={CARD_STYLE}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "#e4e4ef" }}
        >
          Trafficking Likelihood Distribution
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={likelihoodData}>
            <XAxis
              dataKey="range"
              tick={{ fill: "#8888a0", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a3e" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8888a0", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a3e" }}
              tickLine={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {likelihoodData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    index === 0
                      ? "#64748b"
                      : index === 1
                      ? "#3b82f6"
                      : index === 2
                      ? "#f59e0b"
                      : index === 3
                      ? "#ef4444"
                      : "#dc2626"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Timeline */}
      <div
        className="rounded-xl p-5 border"
        style={CARD_STYLE}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "#e4e4ef" }}
        >
          Events by Year
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={timelineData}>
            <XAxis
              dataKey="year"
              tick={{ fill: "#8888a0", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a3e" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#8888a0", fontSize: 11 }}
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
            />
            <Area
              type="monotone"
              dataKey="flagged"
              stackId="2"
              stroke="#ef4444"
              fill="#ef444440"
              name="Flagged"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
