"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { EpsEvent } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import EventTypeBadge from "./EventTypeBadge";
import LikelihoodBadge from "./LikelihoodBadge";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

interface EventsTableProps {
  events: EpsEvent[];
  title?: string;
}

type SortField = "traffickingLikelihood" | "dateNormalized" | "actor" | "eventType";
type SortDir = "asc" | "desc";

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return null;
  return sortDir === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
}

export default function EventsTable({ events }: EventsTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("traffickingLikelihood");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.eventType));
    return Array.from(types).filter(Boolean).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = events;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.actor.toLowerCase().includes(q) ||
          e.recipient.toLowerCase().includes(q) ||
          e.eventDescription.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.quotedEvidence.toLowerCase().includes(q)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter((e) => e.eventType === typeFilter);
    }

    if (flagFilter === "flagged") {
      result = result.filter((e) => e.traffickingFlag);
    } else if (flagFilter === "unflagged") {
      result = result.filter((e) => !e.traffickingFlag);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "traffickingLikelihood") {
        cmp = a.traffickingLikelihood - b.traffickingLikelihood;
      } else if (sortField === "dateNormalized") {
        cmp = (a.dateNormalized || "").localeCompare(b.dateNormalized || "");
      } else if (sortField === "actor") {
        cmp = a.actor.localeCompare(b.actor);
      } else if (sortField === "eventType") {
        cmp = a.eventType.localeCompare(b.eventType);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [events, search, typeFilter, flagFilter, sortField, sortDir]);

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
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[200px]"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
        >
          <Search size={16} style={{ color: "#8888a0" }} />
          <input
            type="text"
            placeholder="Search events, actors, evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: "#e4e4ef" }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e", color: "#e4e4ef" }}
        >
          <option value="all">All Types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t] || t}
            </option>
          ))}
        </select>
        <select
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e", color: "#e4e4ef" }}
        >
          <option value="all">All Events</option>
          <option value="flagged">Flagged Only</option>
          <option value="unflagged">Unflagged Only</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs mb-3" style={{ color: "#8888a0" }}>
        Showing {filtered.length} of {events.length} events
      </p>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a3e" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8888a0" }}>
                  Flag
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#8888a0" }}
                  onClick={() => toggleSort("actor")}
                >
                  <span className="flex items-center gap-1">Actor → Recipient <SortIcon field="actor" sortField={sortField} sortDir={sortDir} /></span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#8888a0" }}
                  onClick={() => toggleSort("eventType")}
                >
                  <span className="flex items-center gap-1">Type <SortIcon field="eventType" sortField={sortField} sortDir={sortDir} /></span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#8888a0" }}>
                  Description
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#8888a0" }}
                  onClick={() => toggleSort("traffickingLikelihood")}
                >
                  <span className="flex items-center gap-1">Likelihood <SortIcon field="traffickingLikelihood" sortField={sortField} sortDir={sortDir} /></span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#8888a0" }}
                  onClick={() => toggleSort("dateNormalized")}
                >
                  <span className="flex items-center gap-1">Date <SortIcon field="dateNormalized" sortField={sortField} sortDir={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event, index) => (
                <tr
                  key={`${event.eventId}-${index}`}
                  className="transition-colors hover:bg-[#1e1e35] cursor-pointer"
                  style={{ borderBottom: "1px solid #2a2a3e" }}
                >
                  <td className="px-4 py-3">
                    {event.traffickingFlag ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ background: "#ef4444", animation: "pulse-dot 2s ease-in-out infinite" }}
                      />
                    ) : (
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ background: "#2a2a3e" }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/events/${event.eventId}`} className="block">
                      <p className="font-medium text-sm" style={{ color: "#e4e4ef" }}>
                        {event.actor}
                      </p>
                      <p className="text-xs" style={{ color: "#8888a0" }}>
                        → {event.recipient}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EventTypeBadge type={event.eventType} />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link href={`/events/${event.eventId}`}>
                      <p className="text-xs truncate" style={{ color: "#8888a0" }}>
                        {event.eventDescription.substring(0, 120)}...
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <LikelihoodBadge value={event.traffickingLikelihood} showBar />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#8888a0" }}>
                    {event.dateNormalized || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
