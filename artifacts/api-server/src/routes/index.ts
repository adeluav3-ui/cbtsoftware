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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/upload", uploadRouter);
router.use(joinInfoRouter);
router.use("/schools", schoolsRouter);
router.use("/schools/:schoolCode/teachers", teachersRouter);
router.use("/schools/:schoolCode/students", studentsRouter);
router.use("/schools/:schoolCode/exams", examsRouter);
router.use("/schools/:schoolCode/results", resultsRouter);
router.use("/schools/:schoolCode/sync", syncRouter);

export default router;