import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

import { computeRow, computePayday } from "./services/internSalaryScheduler";

const U = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const rec = (fields: Record<string, any>) => ({ record_id: "x", fields });

let fails = 0;
function check(label: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 0.01;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got=${got} want=${want}`);
}

// Test 1: 3+3續約 onboard 2026-05-01 (clean month boundaries)
const t1 = (m0: number) => computeRow(rec({ Name: "T1", "Onboard Date": U(2026, 5, 1), "薪資類別": "3+3續約" }), 2026, m0)!;
check("3+3 month1 (May)", t1(4).total, 8000);
check("3+3 month3 (Jul)", t1(6).total, 8000);
check("3+3 month4 (Aug)=10000+6000", t1(7).total, 16000);
check("3+3 month5 (Sep)", t1(8).total, 10000);

// Test 2: 3個月短期, cessation mid-month (Aden-like) → prorate
const t2 = computeRow(rec({ Name: "T2", "Onboard Date": U(2026, 5, 17), "Cessation Date": U(2026, 8, 16), "薪資類別": "3個月短期" }), 2026, 7)!;
check("short prorate Aug 16/31 days", t2.total, Math.round((8000 / 31) * 16 * 100) / 100);

// Test 3: 6個月長期直簽 → flat 10000
const t3 = computeRow(rec({ Name: "T3", "Onboard Date": U(2026, 5, 1), "薪資類別": "6個月長期(直簽)" }), 2026, 7)!;
check("long direct flat", t3.total, 10000);

// Test 4: 3+3續約 onboard mid-month → rate transition mid-Aug + backfill same month
const t4 = computeRow(rec({ Name: "T4", "Onboard Date": U(2026, 5, 17), "薪資類別": "3+3續約" }), 2026, 7)!;
const want4 = Math.round(((8000 / 31) * 16 + (10000 / 31) * 15) * 100) / 100 + 6000;
check("3+3 mid-month transition Aug + backfill", t4.total, want4);

// Test 4b: 3+3續約 but leaves 8/18, one day before month 4 starts (8/19) → NO backfill
const t4b = computeRow(rec({ Name: "T4b", "Onboard Date": U(2026, 5, 19), "Cessation Date": U(2026, 8, 18), "薪資類別": "3+3續約" }), 2026, 7)!;
check("3+3 leaves before month4 → no backfill", t4b.backfill, 0);
check("3+3 leaves before month4 → base only", t4b.total, Math.round((8000 / 31) * 18 * 100) / 100);

// Test 4c: 3+3續約 renewed properly (cessation 11/18), month 4 starts mid-Aug → straddle + backfill
const t4c = computeRow(rec({ Name: "T4c", "Onboard Date": U(2026, 5, 19), "Cessation Date": U(2026, 11, 18), "薪資類別": "3+3續約" }), 2026, 7)!;
const want4c = Math.round(((8000 / 31) * 18 + (10000 / 31) * 13) * 100) / 100 + 6000;
check("3+3 renewed straddle Aug + backfill", t4c.total, want4c);

// Test 4d: TZ safety — Lark stores tenant-local (UTC+8) midnight. A cessation the
// user entered as 8/7 arrives as 2026-08-06T16:00Z; it must count Aug 7 as worked.
const LM = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 8 * 3600 * 1000;
const t4d = computeRow(rec({ Name: "T4d", "Onboard Date": LM(2026, 5, 18), "Cessation Date": LM(2026, 8, 7), "薪資類別": "3個月短期" }), 2026, 7)!;
check("TZ: cessation 8/7 → 7 active days", t4d.activeDays, 7);
check("TZ: last active day = 7", t4d.activeTo, 7);
check("TZ: pay = 8000/31*7", t4d.total, Math.round((8000 / 31) * 7 * 100) / 100);

// Test 7: deferral — onboard 7/25 (≥20) → July deferred (payday 0), caught up in August
const defRec = rec({ Name: "Def", "Onboard Date": U(2026, 7, 25), "Cessation Date": U(2026, 12, 31), "薪資類別": "3個月短期" });
const julP = computePayday(defRec, 2026, 7)!;
check("defer: July payday total 0", julP.paydayTotal, 0);
console.log(`${julP.deferredOut ? "PASS" : "FAIL"}  defer: July flagged deferredOut`);
if (!julP.deferredOut) fails++;
const augP = computePayday(defRec, 2026, 8)!;
const wantAug = 8000 + Math.round((8000 / 31) * 7 * 100) / 100; // Aug full 8000 + July 7 days (7/25–7/31)
check("defer: Aug payday = Aug + catch-up July", augP.paydayTotal, wantAug);
console.log(`${augP.catchUp ? "PASS" : "FAIL"}  defer: Aug carries catch-up`);
if (!augP.catchUp) fails++;

// Test 8: no deferral — onboard 7/15 (<20) → paid normally in July (17 days)
const norRec = rec({ Name: "Nor", "Onboard Date": U(2026, 7, 15), "Cessation Date": U(2026, 12, 31), "薪資類別": "3個月短期" });
const julN = computePayday(norRec, 2026, 7)!;
check("no-defer: July 17 days paid", julN.paydayTotal, Math.round((8000 / 31) * 17 * 100) / 100);
console.log(`${!julN.deferredOut ? "PASS" : "FAIL"}  no-defer: not flagged`);
if (julN.deferredOut) fails++;

// Test 5: unset track → flagged, no crash
const t5 = computeRow(rec({ Name: "T5", "Onboard Date": U(2026, 5, 1) }), 2026, 7)!;
console.log(`${t5.unset ? "PASS" : "FAIL"}  unset track flagged: unset=${t5.unset}`);
if (!t5.unset) fails++;

// Test 6: not active this month → null
const t6 = computeRow(rec({ Name: "T6", "Onboard Date": U(2026, 9, 1), "薪資類別": "3個月短期" }), 2026, 7);
console.log(`${t6 === null ? "PASS" : "FAIL"}  future onboard → null`);
if (t6 !== null) fails++;

console.log(fails === 0 ? "\nALL PASS ✅" : `\n${fails} FAILED ❌`);
process.exit(fails === 0 ? 0 : 1);
