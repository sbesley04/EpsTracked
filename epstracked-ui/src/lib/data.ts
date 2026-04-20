import dataset from "@/data/dataset.json";
import type { Dataset, EpsEvent, Entity, Connection, Summary } from "./types";

const data = dataset as unknown as Dataset;

export function getAllEvents(): EpsEvent[] {
  return data.events;
}

export function getFlaggedEvents(): EpsEvent[] {
  return data.events.filter((e) => e.traffickingFlag);
}

export function getEventById(eventId: string): EpsEvent | undefined {
  return data.events.find((e) => e.eventId === eventId);
}

export function getEventsByThread(threadId: string): EpsEvent[] {
  return data.events.filter((e) => e.threadId === threadId);
}

export function getEventsByEntity(entityId: string): EpsEvent[] {
  return data.events.filter(
    (e) => e.actorEntityId === entityId || e.recipientEntityId === entityId
  );
}

export function getAllEntities(): Entity[] {
  return data.entities;
}

export function getEntityById(entityId: string): Entity | undefined {
  return data.entities.find((e) => e.id === entityId);
}

export function getEntityByName(name: string): Entity | undefined {
  return data.entities.find(
    (e) => e.name.toLowerCase() === name.toLowerCase()
  );
}

export function getAllConnections(): Connection[] {
  return data.connections;
}

export function getConnectionsForEntity(entityId: string): Connection[] {
  return data.connections.filter(
    (c) => c.source === entityId || c.target === entityId
  );
}

export function getSummary(): Summary {
  return data.summary;
}

export function getEntityName(entityId: string): string {
  const entity = getEntityById(entityId);
  return entity?.name ?? entityId;
}

/**
 * Timeline of events by year where the given entity is the primary actor.
 * For "narrative" views focused on a specific actor.
 */
export function getEntityTimeline(entityId: string): {
  year: string;
  total: number;
  flagged: number;
}[] {
  const events = getEventsByEntity(entityId);
  const map: Record<string, { total: number; flagged: number }> = {};
  events.forEach((e) => {
    if (!e.dateNormalized) return;
    const year = e.dateNormalized.substring(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    if (!map[year]) map[year] = { total: 0, flagged: 0 };
    map[year].total++;
    if (e.traffickingFlag) map[year].flagged++;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, ...v }));
}

export function getLikelihoodLevel(likelihood: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (likelihood >= 0.7)
    return { label: "High", color: "text-red-400", bg: "bg-red-500/20" };
  if (likelihood >= 0.4)
    return {
      label: "Medium",
      color: "text-amber-400",
      bg: "bg-amber-500/20",
    };
  if (likelihood >= 0.2)
    return { label: "Low", color: "text-blue-400", bg: "bg-blue-500/20" };
  return {
    label: "Minimal",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
  };
}
