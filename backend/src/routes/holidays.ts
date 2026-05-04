import { Router } from "express";
import { fetchHKHolidays } from "../services/holidayParser";
import { batchCreateEvents } from "../lark/calendar";

const router = Router();

router.post("/sync", async (_req, res, next) => {
  try {
    const events = await fetchHKHolidays();
    const result = await batchCreateEvents(events);
    res.json({ total: events.length, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
