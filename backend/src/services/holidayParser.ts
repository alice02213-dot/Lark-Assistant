import fetch from "node-fetch";
import ical from "node-ical";
import type { CalendarEvent } from "../lark/calendar";

const HK_ICAL_URL = "https://www.1823.gov.hk/common/ical/gc/tc.ic";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchHKHolidays(): Promise<CalendarEvent[]> {
  const res = await fetch(HK_ICAL_URL);
  if (!res.ok) throw new Error(`Failed to fetch iCal: ${res.status}`);
  const text = await res.text();

  const parsed = ical.parseICS(text);
  const events: CalendarEvent[] = [];

  for (const comp of Object.values(parsed)) {
    if (comp.type !== "VEVENT") continue;
    const summary = comp.summary ?? "Hong Kong Holiday";
    const start = comp.start instanceof Date ? comp.start : new Date(comp.start);
    const end = comp.end instanceof Date ? comp.end : new Date(comp.end);

    const startDate = toIsoDate(start);
    // iCal all-day events have an exclusive end date; Lark expects exclusive end too
    const endDate = end ? toIsoDate(end) : addOneDay(startDate);

    events.push({ summary, startDate, endDate, description: "香港公眾假期" });
  }

  return events;
}
