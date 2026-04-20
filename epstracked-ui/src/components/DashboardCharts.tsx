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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Event Types Pie */}
      <div className="rounded-xl p-4 md:p-5 border flex flex-col" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
          Event Types
        </h3>
        <p className="text-xs mt-1 mb-3" style={{ color: "#9999b5" }}>
          Distribution of extracted events by category
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={eventTypeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
              >
                {eventTypeData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 mt-3">
          {eventTypeData.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "#9999b5" }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: item.color }}
              />
              {item.name} ({item.value.toLocaleString()})
            </div>
          ))}
        </div>
      </div>

      {/* Likelihood Distribution */}
      <div className="rounded-xl p-4 md:p-5 border flex flex-col" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
          Trafficking Likelihood Distribution
        </h3>
        <p className="text-xs mt-1 mb-3" style={{ color: "#9999b5" }}>
          Count of events by estimated likelihood bucket
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={likelihoodData}>
              <XAxis
                dataKey="range"
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
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
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
      </div>

      {/* Timeline */}
      <div className="rounded-xl p-4 md:p-5 border flex flex-col" style={CARD_STYLE}>
        <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
          Events by Year
        </h3>
        <p className="text-xs mt-1 mb-3" style={{ color: "#9999b5" }}>
          Total and flagged events over the timeline
        </p>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData}>
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
      </div>
    </div>
  );
}
