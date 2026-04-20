"use client";

import Link from "next/link";
import type { Entity } from "@/lib/types";
import LikelihoodBadge from "./LikelihoodBadge";

interface TopEntitiesProps {
  entities: Entity[];
}

export default function TopEntities({ entities }: TopEntitiesProps) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
    >
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#2a2a3e" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
          Top Entities
        </h3>
        <Link
          href="/entities"
          className="text-xs font-medium"
          style={{ color: "#6366f1" }}
        >
          View all
        </Link>
      </div>
      <div className="divide-y" style={{ borderColor: "#2a2a3e" }}>
        {entities.map((entity) => (
          <Link
            key={entity.id}
            href={`/entities/${entity.id}`}
            className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-[#1e1e35]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "#e4e4ef" }}>
                {entity.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#9999b5" }}>
                {entity.totalEvents} events · {entity.connectionCount} connections
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {entity.flaggedEvents > 0 && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "rgba(239, 68, 68, 0.15)", color: "#fca5a5" }}
                >
                  {entity.flaggedEvents} flagged
                </span>
              )}
              <LikelihoodBadge value={entity.avgTraffickingLikelihood} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
