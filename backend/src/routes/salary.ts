import { Router } from "express";
import { buildSalaryReport, sendMonthlySalary } from "../services/internSalaryScheduler";

const router = Router();

// Preview a given (or current) month's salary report without sending anything.
// GET /api/salary/preview?year=2026&month=8
router.get("/preview", async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(String(req.query.year ?? now.getFullYear()), 10);
    const month = parseInt(String(req.query.month ?? now.getMonth() + 1), 10);
    const report = await buildSalaryReport(year, month);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// Force-send this month's summary to Dora (for testing the bot delivery).
router.post("/test", async (_req, res, next) => {
  try {
    const result = await sendMonthlySalary({ force: true });
    res.json({ ok: true, sentTo: result.sentTo, failed: result.failed, text: result.report.text });
  } catch (err) {
    next(err);
  }
});

export default router;
