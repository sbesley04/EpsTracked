"use client";

import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/types";

interface EventTypeBadgeProps {
  type: string;
}

export default function EventTypeBadge({ type }: EventTypeBadgeProps) {
  const color = EVENT_TYPE_COLORS[type] || EVENT_TYPE_COLORS[""];
  const label = EVENT_TYPE_LABELS[type] || type || "Unknown";

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md"
      style={{
        background: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
