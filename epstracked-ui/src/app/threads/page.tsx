import { getAllEvents } from "@/lib/data";
import ThreadsList from "@/components/ThreadsList";

export default function ThreadsPage() {
  const events = getAllEvents();

  // Group by thread
  const threadMap: Record<string, {
    threadId: string;
    subject: string;
    eventCount: number;
    flaggedCount: number;
    maxLikelihood: number;
    avgLikelihood: number;
    entities: Set<string>;
  }> = {};

  events.forEach((e) => {
    if (!threadMap[e.threadId]) {
      threadMap[e.threadId] = {
        threadId: e.threadId,
        subject: e.subject,
        eventCount: 0,
        flaggedCount: 0,
        maxLikelihood: 0,
        avgLikelihood: 0,
        entities: new Set(),
      };
    }
    const t = threadMap[e.threadId];
    t.eventCount++;
    if (e.traffickingFlag) t.flaggedCount++;
    t.maxLikelihood = Math.max(t.maxLikelihood, e.traffickingLikelihood);
    t.avgLikelihood += e.traffickingLikelihood;
    if (e.actor) t.entities.add(e.actor);
    if (e.recipient) t.entities.add(e.recipient);
  });

  const threads = Object.values(threadMap).map((t) => ({
    ...t,
    avgLikelihood: t.eventCount > 0 ? t.avgLikelihood / t.eventCount : 0,
    entityCount: t.entities.size,
    entityNames: Array.from(t.entities).slice(0, 5),
  }));

  threads.sort((a, b) => b.maxLikelihood - a.maxLikelihood);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
          Threads
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9999b5" }}>
          {threads.length.toLocaleString()} source document threads
        </p>
      </div>
      <ThreadsList threads={threads} />
    </div>
  );
}
