import config from "../config";
import larkClient from "./client";

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

export interface BatchResult {
  created: number;
  failed: number;
  errors: Array<{ event: string; error: string }>;
}

export async function batchCreateEvents(
  events: CalendarEvent[]
): Promise<BatchResult> {
  const result: BatchResult = { created: 0, failed: 0, errors: [] };

  for (const event of events) {
    try {
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
