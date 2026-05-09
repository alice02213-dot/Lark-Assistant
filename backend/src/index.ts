import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../.env");
const dotenvResult = dotenv.config({ path: envPath, override: true });
if (dotenvResult.error) {
  console.warn(`[dotenv] Failed to load ${envPath}:`, dotenvResult.error.message);
} else {
  console.log(`[dotenv] Loaded ${envPath} — LARK_APP_ID=${process.env.LARK_APP_ID}`);
}
import express from "express";
import cors from "cors";
import config from "./config";
import router from "./routes";
import errorHandler from "./middleware/errorHandler";
import { start as startBirthdayScheduler } from "./services/birthdayScheduler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", router);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
  startBirthdayScheduler();
});
