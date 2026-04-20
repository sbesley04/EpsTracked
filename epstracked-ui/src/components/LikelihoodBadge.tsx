"use client";

import { getLikelihoodLevel } from "@/lib/data";

interface LikelihoodBadgeProps {
  value: number;
  showBar?: boolean;
}

export default function LikelihoodBadge({ value, showBar = false }: LikelihoodBadgeProps) {
  const { label, color, bg } = getLikelihoodLevel(value);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${color} ${bg}`}
      >
        {(value * 100).toFixed(0)}%
      </span>
      {showBar && (
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a2e", minWidth: 60 }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${value * 100}%`,
              background:
                value >= 0.7
                  ? "#ef4444"
                  : value >= 0.4
                  ? "#f59e0b"
                  : value >= 0.2
                  ? "#3b82f6"
                  : "#64748b",
            }}
          />
        </div>
      )}
      <span className="text-xs hidden sm:inline" style={{ color: "#9999b5" }}>
        {label}
      </span>
    </div>
  );
}
