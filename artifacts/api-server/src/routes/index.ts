import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import schoolsRouter from "./schools.js";
import teachersRouter from "./teachers.js";
import studentsRouter from "./students.js";
import examsRouter from "./exams.js";
import resultsRouter from "./results.js";
import uploadRouter from "./upload.js";
import joinInfoRouter from "./join-info.js";
import syncRouter from "./sync.js";
import devicesRouter from "./devices.js";
import timeCheckRouter from "./time-check.js";
import { requireAuth } from "../middlewares/auth.js";
import { checkLocalLicense } from "../middlewares/license.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(timeCheckRouter);
router.use("/upload", uploadRouter);
router.use(joinInfoRouter);
// sync manages its own auth — must be mounted BEFORE the requireAuth-gated
// /schools prefix so that import-school is reachable without a session
// (first-time setup) while still protecting re-imports internally.
router.use("/schools/:schoolCode/sync", syncRouter);
router.use("/schools", requireAuth, checkLocalLicense, schoolsRouter);
router.use("/schools/:schoolCode/teachers", requireAuth, checkLocalLicense, teachersRouter);
router.use("/schools/:schoolCode/students", requireAuth, checkLocalLicense, studentsRouter);
router.use("/schools/:schoolCode/exams", requireAuth, checkLocalLicense, examsRouter);
router.use("/schools/:schoolCode/results", requireAuth, checkLocalLicense, resultsRouter);
router.use(devicesRouter);

export default router;