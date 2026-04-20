import Link from "next/link";
import { getEntityById, getEntityTimeline } from "@/lib/data";
import EntityTimelineChart from "@/components/EntityTimelineChart";
import { BookOpen, ArrowUpRight } from "lucide-react";

interface NarrativeEntity {
  id: string;
  heading: string;
  summary: string;
  paragraphs: string[];
}

const NARRATIVES: NarrativeEntity[] = [
  {
    id: "ENT_000001",
    heading: "Jeffrey Epstein",
    summary:
      "2,261 total events · 932 flagged (41%) · Avg risk: 41%",
    paragraphs: [
      "The most central figure in the corpus. Appears as actor in 1,166 events and recipient in 584, spanning 1990–2019.",
      "Over 40% of all events involving Epstein were flagged for trafficking indicators — the highest absolute count of any entity. His top co-occurring entity is Anonymous Victim (685 interactions, 57% flagged), followed by Ghislaine Maxwell (48 interactions, 55% flagged).",
      "Top recurring indicators include procurement of young women, massage/entertainment pretexts, and transportation logistics for unnamed individuals.",
      "Most active years: 2005–2008 (post-plea deal period) and 2015–2019 (media exposure period).",
    ],
  },
  {
    id: "ENT_000015",
    heading: "Ghislaine Maxwell",
    summary: "228 total events · 121 flagged (53%) · Avg risk: 59%",
    paragraphs: [
      "The highest-risk profile among the top 5. More than half her events are flagged, with an average trafficking likelihood of 59% — the highest of any top entity.",
      "Appears predominantly in reported allegations (125 events) and communicative events (56). Has 94 co-events with Epstein — the densest direct overlap of any entity.",
      "Top indicators: “alleged procurer of young women,” “instruction to appear pre-pubescent,” “procurement.”",
      "Active primarily 2003–2019, with a spike around the 2015 civil litigation period. Key locations: Florida, New York, Palm Beach.",
    ],
  },
  {
    id: "ENT_000009",
    heading: "Donald Trump",
    summary: "187 total events · 62 flagged (33%) · Avg risk: 35%",
    paragraphs: [
      "Appears predominantly as a recipient of reported allegations (majority event type), most tied to media coverage and civil filings referencing past social ties to Epstein.",
      "69 events have confirmed dates, spanning 1993–2019. Trafficking-flagged events are concentrated in the reported allegation category rather than direct communicative or realized events, suggesting most risk comes from third-party accounts rather than direct documented interaction.",
      "Top co-entities beyond Epstein: Bill Clinton, unnamed accusers.",
    ],
  },
  {
    id: "ENT_000011",
    heading: "John Sullivan",
    summary: "182 total events · 42 flagged (23%) · Avg risk: 28%",
    paragraphs: [
      "Appears primarily in communicative and relational events — logistics, scheduling, and correspondence. 163 events have confirmed dates spanning 2003–2019.",
      "Flagged rate (23%) is relatively lower, suggesting a more administrative role. Co-occurs frequently with Epstein in email threads but events are largely operational in nature.",
      "Trafficking indicators where present tend to involve contextual proximity (same threads as procurement events) rather than direct flagging language.",
    ],
  },
  {
    id: "ENT_000070",
    heading: "Michael Wolff",
    summary: "175 total events · 35 flagged (20%) · Avg risk: 26%",
    paragraphs: [
      "Primarily appears as a journalist/author source figure — most events are reported_allegation or communicative type tied to his investigative reporting on the Epstein network.",
      "Active 2004–2019, with a concentration around 2015–2016 during the media scrutiny period. The 20% flagged rate largely reflects the content he reported on (e.g., accounts of Epstein’s behavior) rather than direct involvement.",
      "Lowest average risk score among the top 5, consistent with a media intermediary role.",
    ],
  },
];

export default function NarrativePage() {
  const CARD = { background: "#1a1a2e", borderColor: "#2a2a3e" };

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-1">
          <BookOpen size={22} style={{ color: "#a5b4fc" }} />
          <h1 className="text-2xl font-bold" style={{ color: "#e4e4ef" }}>
            Narrative
          </h1>
        </div>
        <p className="text-sm" style={{ color: "#9999b5" }}>
          Contextual summaries and document timelines for the five most central
          entities in the corpus.
        </p>
      </div>

      <div className="space-y-6">
        {NARRATIVES.map((n) => {
          const entity = getEntityById(n.id);
          const timeline = getEntityTimeline(n.id);

          return (
            <section
              key={n.id}
              className="rounded-xl border p-4 md:p-6"
              style={CARD}
            >
              {/* Heading */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h2
                    className="text-lg md:text-xl font-bold"
                    style={{ color: "#e4e4ef" }}
                  >
                    {n.heading}
                    <span
                      className="ml-2 text-xs font-mono font-normal"
                      style={{ color: "#9999b5" }}
                    >
                      {n.id}
                    </span>
                  </h2>
                  <p
                    className="text-xs md:text-sm mt-1 font-medium"
                    style={{ color: "#a5b4fc" }}
                  >
                    {n.summary}
                  </p>
                </div>
                {entity && (
                  <Link
                    href={`/entities/${n.id}`}
                    className="flex items-center gap-1 text-xs font-medium flex-shrink-0 px-2.5 py-1.5 rounded-lg border transition-colors"
                    style={{
                      borderColor: "#2a2a3e",
                      color: "#a5b4fc",
                      background: "rgba(99, 102, 241, 0.08)",
                    }}
                  >
                    Profile <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>

              {/* Paragraphs */}
              <div className="space-y-2 mt-4">
                {n.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="text-sm leading-relaxed"
                    style={{ color: "#c4c4d4" }}
                  >
                    {p}
                  </p>
                ))}
              </div>

              {/* Timeline chart */}
              <div className="mt-5 pt-5 border-t" style={{ borderColor: "#2a2a3e" }}>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "#e4e4ef" }}
                >
                  Document Timeline
                </h3>
                <p className="text-xs mt-1 mb-3" style={{ color: "#9999b5" }}>
                  Events by year in which {n.heading} appears as a primary entity
                  {timeline.length > 0 && (
                    <>
                      {" "}— {timeline.reduce((s, x) => s + x.total, 0).toLocaleString()}{" "}
                      dated events
                    </>
                  )}
                </p>
                <EntityTimelineChart data={timeline} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
