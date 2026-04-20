"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import type { EpsEvent } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import EventTypeBadge from "./EventTypeBadge";
import LikelihoodBadge from "./LikelihoodBadge";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface EventsTableProps {
  events: EpsEvent[];
  title?: string;
}

type SortField = "traffickingLikelihood" | "dateNormalized" | "actor" | "eventType";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (sortField !== field) return null;
  return sortDir === "desc" ? <ChevronDown size={14} /> : <ChevronUp size={14} />;
}

function truncate(text: string, n: number) {
  if (!text) return "";
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;
}

export default function EventsTable({ events }: EventsTableProps) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("traffickingLikelihood");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Debounce search input (180ms); resetting pagination happens inline when
  // the debounced value actually changes, keeping setState out of effects.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => {
        if (prev !== searchInput) setPage(1);
        return searchInput;
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(pageStart, pageEnd);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 min-w-[180px]"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
        >
          <Search size={16} style={{ color: "#9999b5" }} />
          <input
            type="text"
            placeholder="Search events, actors, evidence..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1 min-w-0"
            style={{ color: "#e4e4ef" }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setFlagFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer"
          style={{ background: "#1a1a2e", borderColor: "#2a2a3e", color: "#e4e4ef" }}
        >
          <option value="all">All Events</option>
          <option value="flagged">Flagged Only</option>
          <option value="unflagged">Unflagged Only</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs mb-3" style={{ color: "#9999b5" }}>
        Showing {filtered.length === 0 ? 0 : pageStart + 1}–{pageEnd} of{" "}
        {filtered.length.toLocaleString()} events
        {filtered.length !== events.length && (
          <> (filtered from {events.length.toLocaleString()})</>
        )}
      </p>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {pageItems.map((event, index) => (
          <Link
            key={`${event.eventId}-${index}`}
            href={`/events/${event.eventId}`}
            className="block rounded-xl border p-3 transition-colors hover:bg-[#1e1e35]"
            style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
          >
            <div className="flex items-start gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{
                  background: event.traffickingFlag ? "#ef4444" : "#2a2a3e",
                  animation: event.traffickingFlag
                    ? "pulse-dot 2s ease-in-out infinite"
                    : undefined,
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-medium leading-tight"
                  style={{ color: "#e4e4ef" }}
                >
                  {event.actor}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9999b5" }}>
                  → {event.recipient}
                </p>
              </div>
              <LikelihoodBadge value={event.traffickingLikelihood} />
            </div>
            <p
              className="text-xs leading-relaxed mb-2"
              style={{ color: "#9999b5" }}
            >
              {truncate(event.eventDescription, 140)}
            </p>
            <div className="flex items-center justify-between gap-2">
              <EventTypeBadge type={event.eventType} />
              <span className="text-xs" style={{ color: "#9999b5" }}>
                {event.dateNormalized || "—"}
              </span>
            </div>
          </Link>
        ))}
        {pageItems.length === 0 && (
          <div
            className="rounded-xl border p-6 text-center text-sm"
            style={{ background: "#1a1a2e", borderColor: "#2a2a3e", color: "#9999b5" }}
          >
            No events match your filters.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div
        className="hidden md:block rounded-xl border overflow-hidden"
        style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a3e" }}>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#9999b5" }}
                >
                  Flag
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#9999b5" }}
                  onClick={() => toggleSort("actor")}
                >
                  <span className="flex items-center gap-1">
                    Actor → Recipient{" "}
                    <SortIcon field="actor" sortField={sortField} sortDir={sortDir} />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#9999b5" }}
                  onClick={() => toggleSort("eventType")}
                >
                  <span className="flex items-center gap-1">
                    Type{" "}
                    <SortIcon
                      field="eventType"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#9999b5" }}
                >
                  Description
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#9999b5" }}
                  onClick={() => toggleSort("traffickingLikelihood")}
                >
                  <span className="flex items-center gap-1">
                    Likelihood{" "}
                    <SortIcon
                      field="traffickingLikelihood"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </span>
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: "#9999b5" }}
                  onClick={() => toggleSort("dateNormalized")}
                >
                  <span className="flex items-center gap-1">
                    Date{" "}
                    <SortIcon
                      field="dateNormalized"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((event, index) => (
                <tr
                  key={`${event.eventId}-${index}`}
                  className="transition-colors hover:bg-[#1e1e35] cursor-pointer"
                  style={{ borderBottom: "1px solid #2a2a3e" }}
                >
                  <td className="px-4 py-3">
                    {event.traffickingFlag ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{
                          background: "#ef4444",
                          animation: "pulse-dot 2s ease-in-out infinite",
                        }}
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
                      <p
                        className="font-medium text-sm"
                        style={{ color: "#e4e4ef" }}
                      >
                        {event.actor}
                      </p>
                      <p className="text-xs" style={{ color: "#9999b5" }}>
                        → {event.recipient}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EventTypeBadge type={event.eventType} />
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link href={`/events/${event.eventId}`}>
                      <p className="text-xs" style={{ color: "#9999b5" }}>
                        {truncate(event.eventDescription, 120)}
                      </p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <LikelihoodBadge
                      value={event.traffickingLikelihood}
                      showBar
                    />
                  </td>
                  <td
                    className="px-4 py-3 text-xs whitespace-nowrap"
                    style={{ color: "#9999b5" }}
                  >
                    {event.dateNormalized || "—"}
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: "#9999b5" }}
                  >
                    No events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#1a1a2e",
              borderColor: "#2a2a3e",
              color: "#e4e4ef",
            }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-xs" style={{ color: "#9999b5" }}>
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#1a1a2e",
              borderColor: "#2a2a3e",
              color: "#e4e4ef",
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
