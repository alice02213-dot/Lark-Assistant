import { Router } from "express";
import roomsRouter from "./rooms";
import holidaysRouter from "./holidays";
import birthdaysRouter from "./birthdays";
import calendarsRouter from "./calendars";
import usersRouter from "./users";
import recruitmentRouter from "./recruitment";
import salaryRouter from "./salary";

const router = Router();

router.use("/rooms", roomsRouter);
router.use("/holidays", holidaysRouter);
router.use("/birthdays", birthdaysRouter);
router.use("/calendars", calendarsRouter);
router.use("/users", usersRouter);
router.use("/recruitment", recruitmentRouter);
router.use("/salary", salaryRouter);

export default router;
