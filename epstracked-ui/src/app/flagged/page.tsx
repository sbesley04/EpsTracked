import { getFlaggedEvents } from "@/lib/data";
import EventsTable from "@/components/EventsTable";
import { AlertTriangle } from "lucide-react";

export default function FlaggedPage() {
  const flagged = getFlaggedEvents();

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle size={22} style={{ color: "#ef4444" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
            Flagged Events
          </h1>
        </div>
        <p className="text-sm" style={{ color: "#9999b5" }}>
          {flagged.length.toLocaleString()} events with trafficking indicators detected
        </p>
      </div>
      <EventsTable events={flagged} />
    </div>
  );
}
