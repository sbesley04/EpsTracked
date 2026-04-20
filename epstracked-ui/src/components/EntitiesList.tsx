"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Entity } from "@/lib/types";
import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS } from "@/lib/types";
import LikelihoodBadge from "./LikelihoodBadge";
import { Search } from "lucide-react";

interface EntitiesListProps {
  entities: Entity[];
}

type SortField = "totalEvents" | "avgTraffickingLikelihood" | "flaggedEvents" | "connectionCount" | "name";

export default function EntitiesList({ entities }: EntitiesListProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalEvents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let result = entities;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [entities, search, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div>
      {/* Search & Sort */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[200px]"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
        >
          <Search size={16} style={{ color: "#9999b5" }} />
          <input
            type="text"
            placeholder="Search entities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: "#e4e4ef" }}
          />
        </div>
        <div className="flex gap-2">
          {(["totalEvents", "avgTraffickingLikelihood", "flaggedEvents", "connectionCount"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className="px-3 py-2 rounded-lg border text-xs font-medium transition-colors"
              style={{
                background: sortField === field ? "rgba(99, 102, 241, 0.12)" : "#1a1a2e",
                borderColor: sortField === field ? "rgba(99, 102, 241, 0.3)" : "#2a2a3e",
                color: sortField === field ? "#a5b4fc" : "#9999b5",
              }}
            >
              {field === "totalEvents" ? "Events" : field === "avgTraffickingLikelihood" ? "Risk" : field === "flaggedEvents" ? "Flagged" : "Connections"}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((entity) => (
          <Link
            key={entity.id}
            href={`/entities/${entity.id}`}
            className="rounded-xl border p-5 transition-colors hover:bg-[#1e1e35] block"
            style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
                  {entity.name}
                </h3>
                <p className="text-xs mt-0.5 font-mono" style={{ color: "#9999b5" }}>
                  {entity.id}
                </p>
              </div>
              <LikelihoodBadge value={entity.avgTraffickingLikelihood} />
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div>
                <p className="text-xs" style={{ color: "#9999b5" }}>Events</p>
                <p className="text-sm font-bold" style={{ color: "#6366f1" }}>{entity.totalEvents}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#9999b5" }}>Flagged</p>
                <p className="text-sm font-bold" style={{ color: entity.flaggedEvents > 0 ? "#ef4444" : "#9999b5" }}>{entity.flaggedEvents}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#9999b5" }}>As Actor</p>
                <p className="text-sm font-bold" style={{ color: "#10b981" }}>{entity.asActor}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#9999b5" }}>Links</p>
                <p className="text-sm font-bold" style={{ color: "#8b5cf6" }}>{entity.connectionCount}</p>
              </div>
            </div>

            {/* Event type breakdown */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(entity.eventTypes).map(([type, count]) => (
                <span
                  key={type}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: `${EVENT_TYPE_COLORS[type] || "#6b7280"}15`,
                    color: EVENT_TYPE_COLORS[type] || "#6b7280",
                  }}
                >
                  {EVENT_TYPE_LABELS[type] || type}: {count}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
