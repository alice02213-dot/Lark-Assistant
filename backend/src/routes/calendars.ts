import { Router } from "express";
import { listCalendars, deduplicateEvents } from "../lark/calendar";
import config from "../config";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const calendars = await listCalendars();
    res.json({
      current: config.lark.calendarId,
      calendars,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/dedup", async (_req, res, next) => {
  try {
    const result = await deduplicateEvents();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
