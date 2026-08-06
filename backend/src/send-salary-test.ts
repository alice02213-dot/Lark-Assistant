// One-off TEST send of a salary report to Dora, WITHOUT touching the sent-log, so
// the real 20th-of-month cron still fires normally. Usage: ts-node send-salary-test.ts [year] [month]
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

import { buildSalaryReport } from "./services/internSalaryScheduler";
import { sendTextMessage } from "./lark/im";

const DORA_OPEN_ID = "ou_d648150b253127ad14a385d808cdd947";
const now = new Date();
const year = parseInt(process.argv[2] ?? String(now.getFullYear()), 10);
const month = parseInt(process.argv[3] ?? String(now.getMonth() + 1), 10);

(async () => {
  const report = await buildSalaryReport(year, month);
  await sendTextMessage(DORA_OPEN_ID, report.text);
  console.log(`[send-salary-test] sent ${year}-${month} report to Dora (sent-log untouched)`);
  console.log(report.text);
  process.exit(0);
})().catch((e) => {
  console.error("[send-salary-test] FATAL", e?.message ?? e);
  process.exit(1);
});
