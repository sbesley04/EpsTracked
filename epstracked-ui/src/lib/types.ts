export interface EpsEvent {
  threadId: string;
  subject: string;
  eventId: string;
  eventType: string;
  layer: number;
  actor: string;
  actorEntityId: string;
  recipient: string;
  recipientEntityId: string;
  eventDescription: string;
  quotedEvidence: string;
  source: string;
  sourceType: string;
  dateCase: string;
  dateNormalized: string;
  dateConfidence: string;
  locationNormalized: string;
  locationConfidence: string;
  threadTraffickingLikelihood: number;
  traffickingFlag: boolean;
  traffickingLikelihood: number;
  judgementConfidence: number;
  traffickingIndicators: string;
  flagReasoning: string;
  isDuplicate: boolean;
  duplicateOf: string;
  entitiesFound: string;
}

export interface Entity {
  id: string;
  name: string;
  asActor: number;
  asRecipient: number;
  totalEvents: number;
  flaggedEvents: number;
  avgTraffickingLikelihood: number;
  connectionCount: number;
  connections: string[];
  eventTypes: Record<string, number>;
}

export interface Connection {
  source: string;
  target: string;
  count: number;
  flaggedCount: number;
  avgLikelihood: number;
}

export interface Summary {
  totalEvents: number;
  flaggedEvents: number;
  totalEntities: number;
  totalThreads: number;
  eventTypes: Record<string, number>;
  avgTraffickingLikelihood: number;
}

export interface Dataset {
  events: EpsEvent[];
  entities: Entity[];
  connections: Connection[];
  summary: Summary;
}

export type EventType =
  | "communicative"
  | "reported_allegation"
  | "concealment"
  | "relational"
  | "realized"
  | "financial"
  | "";

export const EVENT_TYPE_COLORS: Record<string, string> = {
  communicative: "#3b82f6",
  reported_allegation: "#ef4444",
  concealment: "#f59e0b",
  relational: "#8b5cf6",
  realized: "#10b981",
  financial: "#06b6d4",
  "": "#6b7280",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  communicative: "Communicative",
  reported_allegation: "Reported Allegation",
  concealment: "Concealment",
  relational: "Relational",
  realized: "Realized",
  financial: "Financial",
  "": "Unknown",
};
