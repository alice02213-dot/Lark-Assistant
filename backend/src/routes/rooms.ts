import { Router } from "express";
import { listRooms, bookRoom } from "../lark/rooms";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const rooms = await listRooms();
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
});

router.post("/book", async (req, res, next) => {
  try {
    const { calendarId, summary, description, roomId, startTime, endTime, attendeeEmails } =
      req.body;

    if (!calendarId || !summary || !roomId || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields: calendarId, summary, roomId, startTime, endTime" });
      return;
    }

    const event = await bookRoom({ calendarId, summary, description, roomId, startTime, endTime, attendeeEmails });
    res.json({ event });
  } catch (err) {
    next(err);
  }
});

export default router;
