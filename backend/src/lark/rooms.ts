import config from "../config";
import larkClient from "./client";

export interface Room {
  room_id: string;
  name: string;
  capacity: number;
  building_name: string;
  floor_name: string;
}

export async function listRooms(): Promise<Room[]> {
  const rooms: Room[] = [];
  let pageToken: string | undefined;

  do {
    const res = await larkClient.get("/meeting_room/room/list", {
      params: { page_size: 50, ...(pageToken ? { page_token: pageToken } : {}) },
    });
    const { rooms: page = [], page_token, has_more } = res.data.data ?? {};
    rooms.push(...page);
    pageToken = has_more ? page_token : undefined;
  } while (pageToken);

  return rooms;
}

export interface BookRoomPayload {
  calendarId: string;
  summary: string;
  description?: string;
  roomId: string;
  startTime: string;
  endTime: string;
  attendeeEmails?: string[];
}

export async function bookRoom(payload: BookRoomPayload) {
  const calId = encodeURIComponent(payload.calendarId);
  const attendees = [
    { type: "resource", resource_id: payload.roomId },
    ...(payload.attendeeEmails ?? []).map((email) => ({
      type: "third_party",
      third_party_email: email,
    })),
  ];

  const res = await larkClient.post(
    `/calendar/v4/calendars/${calId}/events`,
    {
      summary: payload.summary,
      description: payload.description ?? "",
      start_time: { timestamp: String(new Date(payload.startTime).getTime() / 1000) },
      end_time: { timestamp: String(new Date(payload.endTime).getTime() / 1000) },
      attendees,
    }
  );
  return res.data.data?.event ?? res.data.data;
}
