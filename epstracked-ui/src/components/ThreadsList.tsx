"use client";

import { useState, useMemo } from "react";
import LikelihoodBadge from "./LikelihoodBadge";
import { Search, FileText } from "lucide-react";

interface Thread {
  threadId: string;
  subject: string;
  eventCount: number;
  flaggedCount: number;
  maxLikelihood: number;
  avgLikelihood: number;
  entityCount: number;
  entityNames: string[];
}

interface ThreadsListProps {
  threads: Thread[];
}

export default function ThreadsList({ threads }: ThreadsListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return threads;
    const q = search.toLowerCase();
    return threads.filter(
      (t) =>
        t.subject.toLowerCase().includes(q) ||
        t.threadId.toLowerCase().includes(q) ||
        t.entityNames.some((n) => n.toLowerCase().includes(q))
    );
  }, [threads, search]);

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 max-w-md"
        style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
      >
        <Search size={16} style={{ color: "#8888a0" }} />
        <input
          type="text"
          placeholder="Search threads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm outline-none flex-1"
          style={{ color: "#e4e4ef" }}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((thread) => (
          <div
            key={thread.threadId}
            className="rounded-xl border p-5 transition-colors hover:bg-[#1e1e35]"
            style={{ background: "#1a1a2e", borderColor: "#2a2a3e" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={16} style={{ color: "#6366f1" }} />
                  <h3 className="text-sm font-semibold truncate" style={{ color: "#e4e4ef" }}>
                    {thread.subject || "No subject"}
                  </h3>
                </div>
                <p className="text-xs font-mono mb-2 truncate" style={{ color: "#8888a0" }}>
                  {thread.threadId}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {thread.entityNames.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "rgba(139, 92, 246, 0.1)", color: "#c4b5fd" }}
                    >
                      {name}
                    </span>
                  ))}
                  {thread.entityCount > 5 && (
                    <span className="text-xs" style={{ color: "#8888a0" }}>
                      +{thread.entityCount - 5} more
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <LikelihoodBadge value={thread.maxLikelihood} />
                <div className="flex gap-3 text-xs" style={{ color: "#8888a0" }}>
                  <span>{thread.eventCount} events</span>
                  {thread.flaggedCount > 0 && (
                    <span style={{ color: "#fca5a5" }}>
                      {thread.flaggedCount} flagged
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
