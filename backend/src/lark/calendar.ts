import config from "../config";
import larkClient from "./client";

export interface LarkCalendar {
  calendar_id: string;
  summary: string;
  description: string;
  type: string;
  role: string;
}

export async function listCalendars(): Promise<LarkCalendar[]> {
  const res = await larkClient.get("/calendar/v4/calendars");
  return res.data.data?.calendar_list ?? [];
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export async function createEvent(event: CalendarEvent): Promise<string> {
  const calId = encodeURIComponent(config.lark.calendarId);
  const res = await larkClient.post(`/calendar/v4/calendars/${calId}/events`, {
    summary: event.summary,
    description: event.description ?? "",
    start_time: { date: event.startDate },
    end_time: { date: event.endDate },
    is_all_day: true,
  });
  return res.data.data?.event?.event_id ?? "";
}

async function listEventsOnDate(date: string): Promise<Array<{ event_id: string; summary: string }>> {
  const calId = encodeURIComponent(config.lark.calendarId);
  const startTs = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const endTs = startTs + 86400;
  const events: Array<{ event_id: string; summary: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await larkClient.get(`/calendar/v4/calendars/${calId}/events`, {
      params: {
        page_size: 100,
        start_time: String(startTs),
        end_time: String(endTs),
        ...(pageToken ? { page_token: pageToken } : {}),
      },
    });
    const data = res.data.data ?? {};
    for (const ev of data.items ?? []) {
      events.push({ event_id: ev.event_id as string, summary: (ev.summary ?? "") as string });
    }
    pageToken = data.page_token;
  } while (pageToken);

  return events;
}

async function listAllEvents(): Promise<Map<string, string[]>> {
  const calId = encodeURIComponent(config.lark.calendarId);
  const summaryToIds = new Map<string, string[]>();
  let pageToken: string | undefined;

  do {
    const res = await larkClient.get(`/calendar/v4/calendars/${calId}/events`, {
      params: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
    });
    const data = res.data.data ?? {};
    for (const ev of data.items ?? []) {
      const key: string = ev.summary ?? "";
      if (!summaryToIds.has(key)) summaryToIds.set(key, []);
      summaryToIds.get(key)!.push(ev.event_id);
    }
    pageToken = data.page_token;
  } while (pageToken);

  return summaryToIds;
}

async function deleteEvent(eventId: string): Promise<void> {
  const calId = encodeURIComponent(config.lark.calendarId);
  try {
    await larkClient.delete(`/calendar/v4/calendars/${calId}/events/${eventId}`);
  } catch (err: any) {
    // 193003 = event already deleted; safe to ignore
    if (err?.larkCode === 193003 || err?.response?.data?.code === 193003) return;
    throw err;
  }
}

export interface BatchResult {
  created: number;
  failed: number;
  deleted: number;
  errors: Array<{ event: string; error: string }>;
}

export interface DeduplicateResult {
  deleted: number;
  errors: Array<{ event: string; error: string }>;
}

export async function deduplicateEvents(): Promise<DeduplicateResult> {
  const result: DeduplicateResult = { deleted: 0, errors: [] };
  const existing = await listAllEvents();

  for (const [summary, ids] of existing) {
    if (ids.length <= 1) continue;
    // Keep the first, delete the rest
    for (const id of ids.slice(1)) {
      try {
        await deleteEvent(id);
        result.deleted++;
        await delay(100);
      } catch (err: any) {
        result.errors.push({ event: summary, error: err.message ?? String(err) });
      }
    }
  }

  return result;
}

export async function batchCreateEvents(
  events: CalendarEvent[]
): Promise<BatchResult> {
  const result: BatchResult = { created: 0, failed: 0, deleted: 0, errors: [] };

  for (const event of events) {
    try {
      const onDay = await listEventsOnDate(event.startDate);
      const matches = onDay.filter((ev) => ev.summary === event.summary);
      for (const match of matches) {
        await deleteEvent(match.event_id);
        result.deleted++;
        await delay(100);
      }
      await createEvent(event);
      result.created++;
      await delay(200);
    } catch (err: any) {
      result.failed++;
      result.errors.push({ event: event.summary, error: err.message ?? String(err) });
    }
  }

  return result;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
