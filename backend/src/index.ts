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
