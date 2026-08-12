import cron from "node-cron";
import fs from "fs";
import path from "path";
import config from "../config";
import larkClient from "../lark/client";
import { sendTextMessage, type ReceiveIdType } from "../lark/im";

// --- Data source: the "在職數據" table in the HR Base. It holds both full-time
// staff and interns, so salary calc filters to Kind === "intern". ---
const APP_TOKEN = "UbLybT4uHaJAahsZneVlYOLQgyd";
const TABLE_ID = "tblTLJVQrrhpbZ2p";
const INTERN_KIND = "intern";

// The monthly summary goes to these people on the 15th. `key` is used only in the
// sent-log so each person is delivered to at most once per month.
const RECIPIENTS: { key: string; name: string; receiveId: string; idType: ReceiveIdType }[] = [
  { key: "dora", name: "Dora Huang", receiveId: "ou_d648150b253127ad14a385d808cdd947", idType: "open_id" },
  { key: "chenjie", name: "Chen Jie", receiveId: "jchen@cloudalphacap.com", idType: "email" },
  { key: "peideyan", name: "Peide Yan", receiveId: "ou_8cab08e5e167821ce24d5d9ea0ab48a3", idType: "open_id" },
];

// --- Salary rules (RMB) ---------------------------------------------------------
// 3-month short contract: 8000/mo. 6-month long contract: 10000/mo.
// "3+3續約": started on a 3-month short (8000/mo for months 1-3), then upgraded to
// a 6-month long contract — so month 4 pays 10000 plus a one-time 6000 backfill of
// the (10000-8000)*3 difference for months 1-3; months 5+ are 10000/mo.
const RATE_SHORT = 8000;
const RATE_LONG = 10000;
const BACKFILL = (RATE_LONG - RATE_SHORT) * 3; // 6000

// The 薪資類別 single-select label is matched by KEYWORD, not exact string, so the
// classification survives Dora relabelling the options (e.g. adding "(8K)" suffixes).
// The raw label is still shown verbatim in the report.
type Track = "SHORT" | "LONG" | "RENEW";

function classifyTrack(raw: string | null | undefined): Track | null {
  if (!raw) return null;
  if (raw.includes("3+3") || raw.includes("續約")) return "RENEW";
  if (raw.includes("6個月") || raw.includes("長期")) return "LONG";
  if (raw.includes("3個月") || raw.includes("短期")) return "SHORT";
  return null;
}

const SENT_FILE = path.join(config.dataDir, "salary-sent.json");

interface BitableRecord {
  record_id: string;
  fields: Record<string, any>;
}

async function fetchAllRecords(tableId: string): Promise<BitableRecord[]> {
  const all: BitableRecord[] = [];
  let pageToken: string | undefined;
  do {
    const res = await larkClient.get(`/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records`, {
      params: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
    });
    all.push(...(res.data.data?.items ?? []));
    pageToken = res.data.data?.has_more ? res.data.data?.page_token : undefined;
  } while (pageToken);
  return all;
}

// --- Date helpers ---------------------------------------------------------------
// Lark date fields arrive as epoch-ms at UTC midnight of the stored date, so we do
// all calendar reasoning in UTC to avoid timezone drift.

/** Add n calendar months to a UTC date (ms), clamping the day to the target month. */
function addMonthsUTC(ms: number, n: number): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const targetMonthDays = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, targetMonthDays);
  return Date.UTC(y, m + n, clampedDay);
}

function daysInMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/**
 * Contract-month index (1-based) that a given day falls into, anchored on the
 * onboard day-of-month. e.g. onboard May 17 → month 1 = May17–Jun16, month 2 =
 * Jun17–Jul16, ... A day before onboard returns 0.
 */
function contractMonthIndex(onboardMs: number, dayMs: number): number {
  if (dayMs < onboardMs) return 0;
  let elapsed = 0;
  while (addMonthsUTC(onboardMs, elapsed + 1) <= dayMs) elapsed++;
  return elapsed + 1;
}

/**
 * Lark stores date fields as tenant-local midnight (e.g. 2026-08-07 shows up as
 * 2026-08-06T16:00Z for a UTC+8 tenant). Re-read the intended calendar date in the
 * configured timezone and return it as a UTC-midnight ms, so every day-count below
 * is timezone-safe rather than a day early.
 */
function larkDateToUTCDate(ms: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.cron.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value])
  );
  return Date.UTC(parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10));
}

/** Per-day monthly-rate basis for an intern, given their track and the day's contract month. */
function monthlyRateForDay(track: string | null, monthIdx: number): number {
  switch (classifyTrack(track)) {
    case "SHORT":
      return RATE_SHORT;
    case "LONG":
      return RATE_LONG;
    case "RENEW":
      return monthIdx <= 3 ? RATE_SHORT : RATE_LONG;
    default:
      return NaN; // unknown / unset track
  }
}

// A run of consecutive active days at one monthly rate. Most months have a single
// segment; a 3+3 intern crossing the month-3→month-4 boundary mid-month has two
// (e.g. 8/1–8/19 at 8000, 8/20–8/31 at 10000).
export interface RateSegment {
  from: number; // day-of-month
  to: number; // day-of-month
  days: number;
  rate: number; // monthly rate basis (8000 or 10000)
}

export interface SalaryRow {
  name: string;
  track: string | null;
  activeDays: number;
  daysInMonth: number;
  activeFrom: number; // first active day-of-month (0 if none)
  activeTo: number; // last active day-of-month (0 if none)
  segments: RateSegment[]; // rate-tier breakdown of the active days
  fullMonth: boolean;
  base: number; // prorated base pay (excludes backfill)
  backfill: number; // 0 or 6000
  total: number;
  leaving: boolean; // cessation falls within this month
  starting: boolean; // onboard falls within this month
  unset: boolean; // track not set → cannot compute
}

/** Compute one intern's pay for a given calendar month. Returns null if not active that month. */
export function computeRow(rec: BitableRecord, year: number, month0: number): SalaryRow | null {
  const f = rec.fields;
  const name = f["Name"] ?? "(未命名)";
  const onboardRaw = f["Onboard Date"] as number | undefined;
  const cessationRaw = f["Cessation Date"] as number | undefined;
  const track = (f["薪資類別"] as string | undefined) ?? null;

  if (!onboardRaw) return null;
  // Normalise Lark's tenant-local-midnight timestamps to UTC-midnight of the
  // intended calendar date before any day arithmetic.
  const onboard = larkDateToUTCDate(onboardRaw);
  const cessation = cessationRaw != null ? larkDateToUTCDate(cessationRaw) : undefined;

  const daysInMonth = daysInMonthUTC(year, month0);
  const monthStart = Date.UTC(year, month0, 1);
  const monthEnd = Date.UTC(year, month0, daysInMonth);

  // Active window this month = [onboard, cessation] ∩ [monthStart, monthEnd], inclusive.
  const effCessation = cessation ?? Number.MAX_SAFE_INTEGER;
  if (onboard > monthEnd || effCessation < monthStart) return null; // not active this month

  const unset = track === null || Number.isNaN(monthlyRateForDay(track, 1));

  let base = 0;
  let activeDays = 0;
  let activeFrom = 0; // first active day-of-month
  let activeTo = 0; // last active day-of-month
  const segments: RateSegment[] = [];
  let seg: RateSegment | null = null;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayMs = Date.UTC(year, month0, day);
    if (dayMs < onboard || dayMs > effCessation) continue;
    activeDays++;
    if (activeFrom === 0) activeFrom = day;
    activeTo = day;
    if (!unset) {
      const idx = contractMonthIndex(onboard, dayMs);
      const rate = monthlyRateForDay(track!, idx);
      base += rate / daysInMonth;
      // Extend the current segment if the rate and days stay contiguous, else start one.
      if (seg && seg.rate === rate && seg.to === day - 1) {
        seg.to = day;
        seg.days++;
      } else {
        seg = { from: day, to: day, days: 1, rate };
        segments.push(seg);
      }
    }
  }

  // One-time 6000 backfill lands in the calendar month that contains the start of
  // contract month 4 (onboard + 3 months) — only for the 3+3 renewal track, and
  // only if the intern actually reaches month 4 (i.e. hasn't left before it starts).
  // The latter guard stops a boundary-case leaver from being paid a backfill for a
  // month-4 they never worked.
  let backfill = 0;
  if (classifyTrack(track) === "RENEW") {
    const m4StartMs = addMonthsUTC(onboard, 3);
    const m4Start = new Date(m4StartMs);
    const reachesM4 = effCessation >= m4StartMs;
    if (reachesM4 && m4Start.getUTCFullYear() === year && m4Start.getUTCMonth() === month0) {
      backfill = BACKFILL;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    name,
    track,
    activeDays,
    daysInMonth,
    activeFrom,
    activeTo,
    segments,
    fullMonth: activeDays === daysInMonth,
    base: round2(base),
    backfill,
    total: round2(base + backfill),
    leaving: !!cessation && cessation >= monthStart && cessation <= monthEnd,
    starting: onboard >= monthStart && onboard <= monthEnd,
    unset,
  };
}

// --- Payday schedule ------------------------------------------------------------
// Payroll is disbursed at PAYDAY_HOUR:00 (in the configured tz) on PAYDAY_DOM of each
// month. Both the cron trigger and the startup catch-up derive from these, so the
// schedule lives in one place.
const PAYDAY_DOM = 15;
const PAYDAY_HOUR = 17;

// --- Payday assembly (day-of-month cut-off + deferral) --------------------------
// An intern who onboards on/after the payday day-of-month misses that month's run;
// that (partial) month's pay is deferred and paid on the NEXT payday alongside the
// next month's salary. This is a timing rule only — the per-month amounts are still
// the calendar-month prorated figures from computeRow.
// CUTOFF_DAY is intentionally the payday day-of-month: move the payday and this moves with it.
const CUTOFF_DAY = PAYDAY_DOM;

export interface PaydayLine {
  name: string;
  track: string | null;
  unset: boolean;
  onboardDay: number;
  current: SalaryRow | null; // this calendar month's pay
  deferredOut: boolean; // current month deferred to NEXT payday (onboarded ≥15 this month)
  catchUp: SalaryRow | null; // previous month's pay, caught up on this payday
  catchUpMonth: number; // 1-based previous month (for labelling)
  paydayTotal: number;
}

/** Assemble what an intern is actually paid on the payday of (year, month) — the
 *  current month unless it was deferred out, plus any deferred previous month. */
export function computePayday(rec: BitableRecord, year: number, month: number): PaydayLine | null {
  const month0 = month - 1;
  const f = rec.fields;
  const name = f["Name"] ?? "(未命名)";
  const onboardRaw = f["Onboard Date"] as number | undefined;
  if (!onboardRaw) return null;

  const onboard = larkDateToUTCDate(onboardRaw);
  const od = new Date(onboard);
  const onboardDay = od.getUTCDate();
  const onboardY = od.getUTCFullYear();
  const onboardM0 = od.getUTCMonth();

  const current = computeRow(rec, year, month0);
  const deferredOut =
    !!current && onboardY === year && onboardM0 === month0 && onboardDay >= CUTOFF_DAY;

  // Previous calendar month (handles year rollover).
  let py = year;
  let pm0 = month0 - 1;
  if (pm0 < 0) {
    pm0 = 11;
    py = year - 1;
  }
  const onboardedPrevLate = onboardY === py && onboardM0 === pm0 && onboardDay >= CUTOFF_DAY;
  const catchUp = onboardedPrevLate ? computeRow(rec, py, pm0) : null;

  if (!current && !catchUp) return null; // nothing on this payday

  const track = current?.track ?? catchUp?.track ?? null;
  const unset = current?.unset ?? catchUp?.unset ?? false;

  const currentPayable = current && !deferredOut && !current.unset ? current.total : 0;
  const catchUpPayable = catchUp && !catchUp.unset ? catchUp.total : 0;
  const paydayTotal = Math.round((currentPayable + catchUpPayable) * 100) / 100;

  return { name, track, unset, onboardDay, current, deferredOut, catchUp, catchUpMonth: pm0 + 1, paydayTotal };
}

export interface SalaryReport {
  year: number;
  month: number; // 1-based
  lines: PaydayLine[];
  total: number;
  unsetCount: number;
  text: string;
}

const rateTag = (rate: number): string => `${Math.round(rate / 1000)}k`;

/** Describe the active days of a monthly row. Single rate → "整月" / "做7天（…）".
 *  Mid-month rate change (3+3 month-4 boundary) → each segment with its rate tier,
 *  e.g. "8/1–8/19 做19天(8k)　＋　8/20–8/31 做12天(10k)". */
function daysDesc(row: SalaryRow, monthNum: number): string {
  if (row.segments.length > 1) {
    return row.segments
      .map((s) => `${monthNum}/${s.from}–${monthNum}/${s.to} 做${s.days}天(${rateTag(s.rate)})`)
      .join("　＋　");
  }
  if (row.fullMonth) return "整月";
  return `做${row.activeDays}天（${monthNum}/${row.activeFrom}–${monthNum}/${row.activeTo}，當月共${row.daysInMonth}天）`;
}

// Group each intern by the primary thing happening on this payday, so like goes
// with like. First match wins (onboard > leave > 3+3 > deferred catch-up > steady).
type Category = "onboard" | "leave" | "renew" | "deferred" | "steady";

function category(l: PaydayLine): Category {
  if (l.current?.starting || l.deferredOut) return "onboard"; // onboarded this month
  if (l.current?.leaving) return "leave";
  if (classifyTrack(l.track) === "RENEW") return "renew";
  if (l.catchUp) return "deferred";
  return "steady";
}

const GROUPS: { cat: Category; title: string }[] = [
  { cat: "onboard", title: "🆕 本月入職" },
  { cat: "leave", title: "🔚 本月離職" },
  { cat: "renew", title: "🔁 3+3續約" },
  { cat: "deferred", title: "🔄 順延補發（上月15號後入職）" },
  { cat: "steady", title: "✅ 一般在職" },
];

/** Render one intern's line — work days only, no salary amounts. The salary track
 *  (with wage base) is shown; onboard/leave are conveyed by the group header. */
function renderLine(l: PaydayLine, month: number): string {
  const label = l.track ?? "?"; // show the Base's own label (already carries the wage base)
  if (l.unset) return `• ${l.name}　⚠️ 未設定薪資類別`;

  // On the month the one-time backfill lands, add it as a compact "＋ 補差6000"
  // part — the rate step (8k→10k) is already visible in the day segments.
  const backfillFlag =
    l.current && l.current.backfill > 0 ? `　＋　補差${l.current.backfill.toLocaleString()}` : "";

  // Onboarded on/after the 15th this month → deferred, nothing paid now.
  if (l.deferredOut && !l.catchUp) {
    return `• ${l.name}　${label}　🆕${month}/${l.onboardDay}入職（≥15號）→ 本月順延至下月一併發放`;
  }

  // Plain current month, no deferral in or out.
  if (!l.catchUp && l.current && !l.deferredOut) {
    return `• ${l.name}　${label}　${daysDesc(l.current, month)}${backfillFlag}`;
  }

  // Carries a caught-up previous month (± the current month).
  const segs: string[] = [];
  if (l.catchUp) segs.push(`補發${l.catchUpMonth}月 ${daysDesc(l.catchUp, l.catchUpMonth)}`);
  if (l.current && !l.deferredOut) segs.push(`本月 ${daysDesc(l.current, month)}${backfillFlag}`);
  return `• ${l.name}　${label}　${segs.join("　＋　")}`;
}

/** Build the full salary report for a payday (1-based month, disbursed on the 15th).
 *  Work days only (no amounts); grouped by event so like sits with like. */
export async function buildSalaryReport(year: number, month: number): Promise<SalaryReport> {
  const records = await fetchAllRecords(TABLE_ID);
  // The table mixes full-time staff and interns — only interns are on this payroll.
  const interns = records.filter((r) => r.fields.Kind === INTERN_KIND);

  const lines: PaydayLine[] = [];
  for (const r of interns) {
    const line = computePayday(r, year, month);
    if (line) lines.push(line);
  }

  const total = lines.filter((l) => !l.unset).reduce((s, l) => s + l.paydayTotal, 0);
  const unsetCount = lines.filter((l) => l.unset).length;

  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const out: string[] = [`💰 Intern 薪資結算 ${ym}（15號發薪，${lines.length} 位）`];

  const byName = (a: PaydayLine, b: PaydayLine) => a.name.localeCompare(b.name);
  for (const g of GROUPS) {
    const members = lines.filter((l) => category(l) === g.cat).sort(byName);
    if (!members.length) continue;
    out.push("", g.title);
    for (const l of members) out.push(renderLine(l, month));
  }

  if (unsetCount > 0) {
    out.push("", `⚠️ 有 ${unsetCount} 位尚未設定「薪資類別」，請到 Base 補上。`);
  }

  return { year, month, lines, total, unsetCount, text: out.join("\n") };
}

// --- Current payroll date/time in the configured timezone -----------------------
function currentYearMonthInTz(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  monthKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.cron.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const year = parseInt(p.year, 10);
  const month = parseInt(p.month, 10);
  const day = parseInt(p.day, 10);
  const hour = parseInt(p.hour === "24" ? "0" : p.hour, 10);
  return { year, month, day, hour, monthKey: `${p.year}-${p.month}` };
}

// --- "already sent" log: { "YYYY-MM": ["recipientKey", ...] } — each recipient is
// delivered to at most once per payroll month, so a retry only fills in whoever
// was missed (e.g. a transient failure) without re-spamming those already sent.
type SentLog = Record<string, string[]>;

function readSentLog(): SentLog {
  if (!fs.existsSync(SENT_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SENT_FILE, "utf-8")) as SentLog;
  } catch {
    return {};
  }
}

function writeSentLog(log: SentLog): void {
  const keys = Object.keys(log).sort();
  while (keys.length > 24) delete log[keys.shift()!]; // keep ~2 years
  fs.writeFileSync(SENT_FILE, JSON.stringify(log, null, 2), "utf-8");
}

/** Send this month's salary summary to every configured recipient, skipping anyone
 *  already sent to this month (unless force). Idempotent per recipient. */
export async function sendMonthlySalary(opts?: { force?: boolean }): Promise<{
  sentTo: string[];
  skipped: string[];
  failed: string[];
  report: SalaryReport;
}> {
  const { year, month, monthKey } = currentYearMonthInTz();
  const report = await buildSalaryReport(year, month);

  const log = readSentLog();
  const already = new Set(opts?.force ? [] : log[monthKey] ?? []);
  const sentTo: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const r of RECIPIENTS) {
    if (already.has(r.key)) {
      skipped.push(r.name);
      continue;
    }
    try {
      await sendTextMessage(r.receiveId, report.text, r.idType);
      already.add(r.key);
      sentTo.push(r.name);
      console.log(`[intern-salary] sent ${monthKey} to ${r.name}`);
    } catch (err) {
      failed.push(r.name);
      console.error(`[intern-salary] failed to send ${monthKey} to ${r.name}:`, err);
    }
  }

  log[monthKey] = [...already];
  writeSentLog(log);
  return { sentTo, skipped, failed, report };
}

let task: cron.ScheduledTask | null = null;

export function start() {
  // 1) In-process cron at PAYDAY_HOUR:00 on PAYDAY_DOM of each month, in the configured tz.
  task = cron.schedule(
    `0 ${PAYDAY_HOUR} ${PAYDAY_DOM} * *`,
    () => void sendMonthlySalary().catch((e) => console.error("[intern-salary] error:", e)),
    { timezone: config.cron.timezone }
  );
  console.log(`Intern salary scheduler started (TZ: ${config.cron.timezone})`);

  // 2) Startup catch-up: if the backend boots at/after this month's payday moment
  //    (PAYDAY_DOM at PAYDAY_HOUR:00) — e.g. the laptop was off at 17:00 on the 15th
  //    and opened later — send this month's summary now. sendMonthlySalary is
  //    idempotent per-recipient per-month via salary-sent.json, so a boot when it was
  //    already sent is a harmless no-op. Only covers the CURRENT payroll month; a
  //    multi-week outage spanning a *past* month's payday is not retroactively caught up.
  const { day, hour } = currentYearMonthInTz();
  const paydayPassed = day > PAYDAY_DOM || (day === PAYDAY_DOM && hour >= PAYDAY_HOUR);
  if (paydayPassed) {
    sendMonthlySalary()
      .then((r) => {
        if (r.sentTo.length > 0)
          console.log(`[intern-salary] startup catch-up sent to ${r.sentTo.join(", ")}`);
      })
      .catch((e) => console.error("[intern-salary] catch-up error:", e));
  }
}

export function stop() {
  task?.stop();
}
