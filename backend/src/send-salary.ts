// Standalone monthly salary sender — can be wired to a Windows scheduled task on
// the 20th. Idempotent via salary-sent.json, so it never double-sends even if the
// in-process cron also fires. Run: npm run send-salary
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

import { sendMonthlySalary } from "./services/internSalaryScheduler";

(async () => {
  const ts = new Date().toISOString();
  const r = await sendMonthlySalary();
  console.log(
    `[send-salary] ${ts} sentTo=[${r.sentTo.join(", ")}] skipped=[${r.skipped.join(", ")}] failed=[${r.failed.join(", ")}] unset=${r.report.unsetCount}`
  );
  process.exit(r.failed.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[send-salary] FATAL", e);
  process.exit(1);
});
