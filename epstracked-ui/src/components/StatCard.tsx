"use client";

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  accentColor?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  accentColor = "#6366f1",
}: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5 border transition-colors"
      style={{
        background: "#1a1a2e",
        borderColor: "#2a2a3e",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: "#9999b5" }}>
            {label}
          </p>
          <p className="text-2xl font-bold" style={{ color: accentColor }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs mt-1" style={{ color: "#9999b5" }}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="p-2.5 rounded-lg"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
