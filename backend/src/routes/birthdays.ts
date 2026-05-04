import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { readBirthdays, writeBirthdays } from "../services/birthdayScheduler";
import { sendTextMessage } from "../lark/im";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ birthdays: readBirthdays() });
});

router.post("/", async (req, res, next) => {
  try {
    const { name, receiveId, receiveIdType = "open_id", month, day, message } = req.body;
    if (!name || !receiveId || !month || !day) {
      res.status(400).json({ error: "Missing required fields: name, receiveId, month, day" });
      return;
    }
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      res.status(400).json({ error: "Invalid month (1-12) or day (1-31)" });
      return;
    }

    const birthdays = readBirthdays();
    const entry = { id: uuidv4(), name, receiveId, receiveIdType, month: m, day: d, message };
    birthdays.push(entry);
    await writeBirthdays(birthdays);
    res.status(201).json({ birthday: entry });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const birthdays = readBirthdays().filter((b) => b.id !== req.params.id);
    await writeBirthdays(birthdays);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/test", async (req, res, next) => {
  try {
    const birthday = readBirthdays().find((b) => b.id === req.params.id);
    if (!birthday) {
      res.status(404).json({ error: "Birthday entry not found" });
      return;
    }
    const text =
      birthday.message ??
      `🎂 生日快樂，${birthday.name}！祝你身體健康，萬事如意！Happy Birthday! 🎉`;
    await sendTextMessage(birthday.receiveId, text, birthday.receiveIdType as any);
    res.json({ ok: true, message: text });
  } catch (err) {
    next(err);
  }
});

export default router;
