import {
  getEntityById,
  getEventsByEntity,
  getConnectionsForEntity,
  getEntityName,
} from "@/lib/data";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import EventTypeBadge from "@/components/EventTypeBadge";
import LikelihoodBadge from "@/components/LikelihoodBadge";
import { ArrowLeft, Users, Activity } from "lucide-react";

interface Props {
  params: Promise<{ entityId: string }>;
}

export default async function EntityDetailPage({ params }: Props) {
  const { entityId } = await params;
  const entity = getEntityById(entityId);
  if (!entity) return notFound();

  const events = getEventsByEntity(entityId);
  const connections = getConnectionsForEntity(entityId);

  const CARD = { background: "#1a1a2e", borderColor: "#2a2a3e" };

  return (
    <div className="p-8 max-w-5xl">
      <Link
        href="/entities"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: "#8888a0" }}
      >
        <ArrowLeft size={16} /> Back to Entities
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
          {entity.name}
        </h1>
        <p className="text-sm font-mono mt-1" style={{ color: "#8888a0" }}>
          {entity.id}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl border p-4" style={CARD}>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8888a0" }}>Total Events</p>
          <p className="text-xl font-bold mt-1" style={{ color: "#6366f1" }}>{entity.totalEvents}</p>
        </div>
        <div className="rounded-xl border p-4" style={CARD}>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8888a0" }}>Flagged</p>
          <p className="text-xl font-bold mt-1" style={{ color: "#ef4444" }}>{entity.flaggedEvents}</p>
        </div>
        <div className="rounded-xl border p-4" style={CARD}>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8888a0" }}>As Actor</p>
          <p className="text-xl font-bold mt-1" style={{ color: "#10b981" }}>{entity.asActor}</p>
        </div>
        <div className="rounded-xl border p-4" style={CARD}>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8888a0" }}>As Recipient</p>
          <p className="text-xl font-bold mt-1" style={{ color: "#f59e0b" }}>{entity.asRecipient}</p>
        </div>
        <div className="rounded-xl border p-4" style={CARD}>
          <p className="text-xs uppercase tracking-wider" style={{ color: "#8888a0" }}>Avg Risk</p>
          <p className="text-xl font-bold mt-1" style={{ color: entity.avgTraffickingLikelihood >= 0.5 ? "#ef4444" : "#f59e0b" }}>
            {(entity.avgTraffickingLikelihood * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Events list */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border overflow-hidden" style={CARD}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#2a2a3e" }}>
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#e4e4ef" }}>
                <Activity size={16} style={{ color: "#6366f1" }} />
                Events ({events.length})
              </h2>
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
                        {event.traffickingFlag && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
                        )}
                        <span className="text-xs font-medium" style={{ color: "#e4e4ef" }}>
                          {event.actor} → {event.recipient}
                        </span>
                        <EventTypeBadge type={event.eventType} />
                      </div>
                      <p className="text-xs truncate" style={{ color: "#8888a0" }}>
                        {event.eventDescription.substring(0, 120)}...
                      </p>
                    </div>
                    <LikelihoodBadge value={event.traffickingLikelihood} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Connections */}
        <div>
          <div className="rounded-xl border p-5" style={CARD}>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4" style={{ color: "#e4e4ef" }}>
              <Users size={16} style={{ color: "#8b5cf6" }} />
              Connections ({connections.length})
            </h2>
            <div className="space-y-2">
              {connections
                .sort((a, b) => b.count - a.count)
                .map((conn) => {
                  const otherId = conn.source === entityId ? conn.target : conn.source;
                  const otherName = getEntityName(otherId);
                  return (
                    <Link
                      key={`${conn.source}-${conn.target}`}
                      href={`/entities/${otherId}`}
                      className="flex items-center justify-between p-2.5 rounded-lg transition-colors hover:bg-[#1e1e35]"
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#e4e4ef" }}>
                          {otherName}
                        </p>
                        <p className="text-xs" style={{ color: "#8888a0" }}>
                          {conn.count} interactions
                          {conn.flaggedCount > 0 && (
                            <span style={{ color: "#fca5a5" }}> · {conn.flaggedCount} flagged</span>
                          )}
                        </p>
                      </div>
                      <LikelihoodBadge value={conn.avgLikelihood} />
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Event type breakdown */}
          <div className="rounded-xl border p-5 mt-6" style={CARD}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
              Event Types
            </h2>
            <div className="space-y-2">
              {Object.entries(entity.eventTypes).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: EVENT_TYPE_COLORS[type] || "#6b7280" }} />
                    <span className="text-xs" style={{ color: "#c4c4d4" }}>
                      {EVENT_TYPE_LABELS[type] || type}
                    </span>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#e4e4ef" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
