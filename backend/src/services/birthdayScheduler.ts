import cron from "node-cron";
import fs from "fs";
import path from "path";
import config from "../config";
import { sendTextMessage } from "../lark/im";

export interface Birthday {
  id: string;
  name: string;
  receiveId: string;
  receiveIdType: string;
  month: number;
  day: number;
  message?: string;
}

const DATA_FILE = path.join(config.dataDir, "birthdays.json");

export function readBirthdays(): Birthday[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as Birthday[];
  } catch {
    return [];
  }
}

let writeChain = Promise.resolve();

export function writeBirthdays(birthdays: Birthday[]): Promise<void> {
  writeChain = writeChain.then(() =>
    fs.promises.writeFile(DATA_FILE, JSON.stringify(birthdays, null, 2), "utf-8")
  );
  return writeChain;
}

let task: cron.ScheduledTask | null = null;

export function start() {
  task = cron.schedule(
    "0 9 * * *",
    async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      const todays = readBirthdays().filter(
        (b) => b.month === month && b.day === day
      );

      for (const b of todays) {
        const text =
          b.message ??
          `🎂 生日快樂，${b.name}！祝你身體健康，萬事如意！Happy Birthday! 🎉`;
        try {
          await sendTextMessage(b.receiveId, text, b.receiveIdType as any);
          console.log(`Birthday wish sent to ${b.name}`);
        } catch (err) {
          console.error(`Failed to send birthday wish to ${b.name}:`, err);
        }
      }
    },
    { timezone: config.cron.timezone }
  );
  console.log(`Birthday scheduler started (TZ: ${config.cron.timezone})`);
}

export function stop() {
  task?.stop();
}
