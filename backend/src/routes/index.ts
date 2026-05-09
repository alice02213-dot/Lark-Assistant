import { Router } from "express";
import roomsRouter from "./rooms";
import holidaysRouter from "./holidays";
import birthdaysRouter from "./birthdays";
import calendarsRouter from "./calendars";

const router = Router();

router.use("/rooms", roomsRouter);
router.use("/holidays", holidaysRouter);
router.use("/birthdays", birthdaysRouter);
router.use("/calendars", calendarsRouter);

export default router;
