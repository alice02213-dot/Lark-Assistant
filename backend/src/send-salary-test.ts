// One-off TEST send of a salary report, WITHOUT touching the sent-log, so the real
// 20th-of-month cron still fires normally.
// Usage: ts-node send-salary-test.ts [year] [month] [recipient]
// recipient defaults to Dora's open_id; an "@"-containing value is treated as email.
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

import { buildSalaryReport } from "./services/internSalaryScheduler";
import { sendTextMessage } from "./lark/im";

const DORA_OPEN_ID = "ou_d648150b253127ad14a385d808cdd947";
const now = new Date();
const year = parseInt(process.argv[2] ?? String(now.getFullYear()), 10);
const month = parseInt(process.argv[3] ?? String(now.getMonth() + 1), 10);
const recipient = process.argv[4] ?? DORA_OPEN_ID;
const idType = recipient.includes("@") ? "email" : "open_id";

(async () => {
  const report = await buildSalaryReport(year, month);
  await sendTextMessage(recipient, report.text, idType);
  console.log(`[send-salary-test] sent ${year}-${month} report to ${recipient} (${idType}, sent-log untouched)`);
  console.log(report.text);
  process.exit(0);
})().catch((e) => {
  console.error("[send-salary-test] FATAL", e?.message ?? e);
  process.exit(1);
});
