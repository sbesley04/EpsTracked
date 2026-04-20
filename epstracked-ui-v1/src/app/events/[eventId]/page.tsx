import { getEventById, getEventsByThread } from "@/lib/data";
import { notFound } from "next/navigation";
import Link from "next/link";
import EventTypeBadge from "@/components/EventTypeBadge";
import LikelihoodBadge from "@/components/LikelihoodBadge";
import { ArrowLeft, Quote, MapPin, Calendar, Users, FileText } from "lucide-react";

interface Props {
  params: Promise<{ eventId: string }>;
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  const event = getEventById(eventId);
  if (!event) return notFound();

  const threadEvents = getEventsByThread(event.threadId);
  const otherThreadEvents = threadEvents.filter((e) => e.eventId !== event.eventId);

  const indicators = event.traffickingIndicators
    ? event.traffickingIndicators.split(";").map((s) => s.trim()).filter(Boolean)
    : [];

  const CARD = { background: "#1a1a2e", borderColor: "#2a2a3e" };

  return (
    <div className="p-8 max-w-5xl">
      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: "#8888a0" }}
      >
        <ArrowLeft size={16} /> Back to Events
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {event.traffickingFlag && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: "#ef4444", animation: "pulse-dot 2s ease-in-out infinite" }}
              />
            )}
            <h1 className="text-xl font-bold" style={{ color: "#e4e4ef" }}>
              {event.actor} → {event.recipient}
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <EventTypeBadge type={event.eventType} />
            <span className="text-xs" style={{ color: "#8888a0" }}>
              Layer {event.layer}
            </span>
            <span className="text-xs" style={{ color: "#8888a0" }}>
              {event.eventId}
            </span>
          </div>
        </div>
        <LikelihoodBadge value={event.traffickingLikelihood} showBar />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border p-5" style={CARD}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
              Event Description
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "#c4c4d4" }}>
              {event.eventDescription}
            </p>
          </div>

          {/* Quoted Evidence */}
          {event.quotedEvidence && (
            <div className="rounded-xl border p-5" style={CARD}>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#e4e4ef" }}>
                <Quote size={16} style={{ color: "#6366f1" }} /> Quoted Evidence
              </h2>
              <blockquote
                className="text-sm leading-relaxed italic pl-4 border-l-2"
                style={{ color: "#c4c4d4", borderColor: "#6366f1" }}
              >
                &ldquo;{event.quotedEvidence}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Trafficking Assessment */}
          <div className="rounded-xl border p-5" style={CARD}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
              Trafficking Assessment
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#8888a0" }}>
                  Likelihood
                </p>
                <p className="text-lg font-bold" style={{ color: event.traffickingLikelihood >= 0.7 ? "#ef4444" : event.traffickingLikelihood >= 0.4 ? "#f59e0b" : "#3b82f6" }}>
                  {(event.traffickingLikelihood * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#8888a0" }}>
                  Confidence
                </p>
                <p className="text-lg font-bold" style={{ color: "#8b5cf6" }}>
                  {(event.judgementConfidence * 100).toFixed(0)}%
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#8888a0" }}>
                  Thread Prior
                </p>
                <p className="text-lg font-bold" style={{ color: "#06b6d4" }}>
                  {(event.threadTraffickingLikelihood * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {indicators.length > 0 && (
              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8888a0" }}>
                  Indicators
                </p>
                <div className="flex flex-wrap gap-2">
                  {indicators.map((ind, i) => (
                    <span
                      key={i}
                      className="text-xs px-2.5 py-1 rounded-md"
                      style={{ background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                    >
                      {ind}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {event.flagReasoning && (
              <div>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8888a0" }}>
                  Reasoning
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "#c4c4d4" }}>
                  {event.flagReasoning}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="rounded-xl border p-5" style={CARD}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
              Metadata
            </h2>
            <div className="space-y-3">
              {event.dateNormalized && (
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#8888a0" }} />
                  <div>
                    <p className="text-xs" style={{ color: "#8888a0" }}>Date</p>
                    <p className="text-sm" style={{ color: "#e4e4ef" }}>
                      {event.dateNormalized}
                      <span className="text-xs ml-1" style={{ color: "#8888a0" }}>
                        ({event.dateConfidence})
                      </span>
                    </p>
                  </div>
                </div>
              )}
              {event.locationNormalized && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#8888a0" }} />
                  <div>
                    <p className="text-xs" style={{ color: "#8888a0" }}>Location</p>
                    <p className="text-sm" style={{ color: "#e4e4ef" }}>
                      {event.locationNormalized}
                      <span className="text-xs ml-1" style={{ color: "#8888a0" }}>
                        ({event.locationConfidence})
                      </span>
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <FileText size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#8888a0" }} />
                <div>
                  <p className="text-xs" style={{ color: "#8888a0" }}>Thread</p>
                  <p className="text-sm" style={{ color: "#e4e4ef" }}>
                    {event.subject || "No subject"}
                  </p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "#8888a0" }}>
                    {event.threadId.substring(0, 30)}...
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Entities in thread */}
          <div className="rounded-xl border p-5" style={CARD}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#e4e4ef" }}>
              <Users size={16} style={{ color: "#8b5cf6" }} /> Entities in Thread
            </h2>
            <div className="flex flex-wrap gap-2">
              {event.entitiesFound.split("; ").map((ent, i) => {
                const match = ent.match(/^(.+)\s*\((ENT_\d+)\)$/);
                if (!match) return null;
                const [, name, id] = match;
                return (
                  <Link
                    key={`${id}-${i}`}
                    href={`/entities/${id}`}
                    className="text-xs px-2.5 py-1 rounded-md transition-colors"
                    style={{ background: "rgba(139, 92, 246, 0.1)", color: "#c4b5fd", border: "1px solid rgba(139, 92, 246, 0.2)" }}
                  >
                    {name.trim()}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Other events in thread */}
          {otherThreadEvents.length > 0 && (
            <div className="rounded-xl border p-5" style={CARD}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "#e4e4ef" }}>
                Other Events in Thread ({otherThreadEvents.length})
              </h2>
              <div className="space-y-2">
                {otherThreadEvents.slice(0, 5).map((te, i) => (
                  <Link
                    key={`${te.eventId}-${i}`}
                    href={`/events/${te.eventId}`}
                    className="block p-2 rounded-lg transition-colors hover:bg-[#1e1e35]"
                  >
                    <div className="flex items-center gap-2">
                      {te.traffickingFlag && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
                      )}
                      <span className="text-xs truncate" style={{ color: "#e4e4ef" }}>
                        {te.actor} → {te.recipient}
                      </span>
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#8888a0" }}>
                      {te.eventDescription.substring(0, 80)}...
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
