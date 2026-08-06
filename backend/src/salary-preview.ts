import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

import { buildSalaryReport } from "./services/internSalaryScheduler";

const year = parseInt(process.argv[2] ?? "2026", 10);
const month = parseInt(process.argv[3] ?? "8", 10);

(async () => {
  const r = await buildSalaryReport(year, month);
  console.log(r.text);
  process.exit(0);
})().catch((e) => {
  console.error("PREVIEW ERR", e?.message ?? e);
  process.exit(1);
});
