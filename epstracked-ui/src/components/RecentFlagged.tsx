"use client";

import Link from "next/link";
import type { EpsEvent } from "@/lib/types";
import EventTypeBadge from "./EventTypeBadge";
import LikelihoodBadge from "./LikelihoodBadge";

interface RecentFlaggedProps {
  events: EpsEvent[];
}

export default function RecentFlagged({ events }: RecentFlaggedProps) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
    >
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#2a2a3e" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#e4e4ef" }}>
          Flagged Events
        </h3>
        <Link
          href="/flagged"
          className="text-xs font-medium"
          style={{ color: "#6366f1" }}
        >
          View all
        </Link>
      </div>
      <div className="divide-y" style={{ borderColor: "#2a2a3e" }}>
        {events.map((event, index) => (
          <Link
            key={`${event.eventId}-${index}`}
            href={`/events/${event.eventId}`}
            className="block px-5 py-3 transition-colors hover:bg-[#1e1e35]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#ef4444", animation: "pulse-dot 2s ease-in-out infinite" }}
                  />
                  <span className="text-xs font-medium truncate" style={{ color: "#e4e4ef" }}>
                    {event.actor} → {event.recipient}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: "#9999b5" }}>
                  {event.eventDescription.substring(0, 100)}...
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <LikelihoodBadge value={event.traffickingLikelihood} />
                <EventTypeBadge type={event.eventType} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
