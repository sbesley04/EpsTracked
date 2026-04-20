import { getAllEvents } from "@/lib/data";
import EventsTable from "@/components/EventsTable";

export default function EventsPage() {
  const events = getAllEvents();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
          Events
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8888a0" }}>
          Browse and filter all {events.length} extracted events
        </p>
      </div>
      <EventsTable events={events} />
    </div>
  );
}
