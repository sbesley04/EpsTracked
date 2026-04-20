import {
  getSummary,
  getAllEvents,
  getAllEntities,
  getFlaggedEvents,
} from "@/lib/data";
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from "@/lib/types";
import StatCard from "@/components/StatCard";
import DashboardCharts from "@/components/DashboardCharts";
import RecentFlagged from "@/components/RecentFlagged";
import TopEntities from "@/components/TopEntities";
import {
  FileText,
  AlertTriangle,
  Users,
  Layers,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const summary = getSummary();
  const events = getAllEvents();
  const entities = getAllEntities();
  const flagged = getFlaggedEvents();

  // Prepare chart data
  const eventTypeData = Object.entries(summary.eventTypes)
    .filter(([k]) => k !== "")
    .map(([type, count]) => ({
      name: EVENT_TYPE_LABELS[type] || type,
      value: count,
      color: EVENT_TYPE_COLORS[type] || "#6b7280",
    }));

  // Likelihood distribution
  const likelihoodBuckets = [
    { range: "0-20%", min: 0, max: 0.2, count: 0 },
    { range: "20-40%", min: 0.2, max: 0.4, count: 0 },
    { range: "40-60%", min: 0.4, max: 0.6, count: 0 },
    { range: "60-80%", min: 0.6, max: 0.8, count: 0 },
    { range: "80-100%", min: 0.8, max: 1.01, count: 0 },
  ];
  events.forEach((e) => {
    const bucket = likelihoodBuckets.find(
      (b) => e.traffickingLikelihood >= b.min && e.traffickingLikelihood < b.max
    );
    if (bucket) bucket.count++;
  });

  // Timeline data (events by normalized year)
  const timelineMap: Record<string, { total: number; flagged: number }> = {};
  events.forEach((e) => {
    if (e.dateNormalized) {
      const year = e.dateNormalized.substring(0, 4);
      if (!timelineMap[year]) timelineMap[year] = { total: 0, flagged: 0 };
      timelineMap[year].total++;
      if (e.traffickingFlag) timelineMap[year].flagged++;
    }
  });
  const timelineData = Object.entries(timelineMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, data]) => ({ year, ...data }));

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9999b5" }}>
          Overview of extracted events, entities, and trafficking indicators
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard
          label="Total Events"
          value={summary.totalEvents}
          subtitle="Across all threads"
          icon={<FileText size={20} />}
          accentColor="#6366f1"
        />
        <StatCard
          label="Flagged Events"
          value={summary.flaggedEvents}
          subtitle={`${((summary.flaggedEvents / summary.totalEvents) * 100).toFixed(0)}% of total`}
          icon={<AlertTriangle size={20} />}
          accentColor="#ef4444"
        />
        <StatCard
          label="Entities"
          value={summary.totalEntities}
          subtitle="Unique actors & recipients"
          icon={<Users size={20} />}
          accentColor="#8b5cf6"
        />
        <StatCard
          label="Threads"
          value={summary.totalThreads}
          subtitle="Source document threads"
          icon={<Layers size={20} />}
          accentColor="#06b6d4"
        />
        <StatCard
          label="Avg Likelihood"
          value={`${(summary.avgTraffickingLikelihood * 100).toFixed(0)}%`}
          subtitle="Trafficking likelihood"
          icon={<TrendingUp size={20} />}
          accentColor="#f59e0b"
        />
      </div>

      {/* Charts */}
      <DashboardCharts
        eventTypeData={eventTypeData}
        likelihoodData={likelihoodBuckets.map((b) => ({
          range: b.range,
          count: b.count,
        }))}
        timelineData={timelineData}
      />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
        <RecentFlagged events={flagged.slice(0, 8)} />
        <TopEntities entities={entities.slice(0, 8)} />
      </div>
    </div>
  );
}
