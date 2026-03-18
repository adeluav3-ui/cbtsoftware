import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import schoolsRouter from "./schools";
import teachersRouter from "./teachers";
import studentsRouter from "./students";
import examsRouter from "./exams";
import resultsRouter from "./results";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/schools", schoolsRouter);
router.use("/schools/:schoolCode/teachers", teachersRouter);
router.use("/schools/:schoolCode/students", studentsRouter);
router.use("/schools/:schoolCode/exams", examsRouter);
router.use("/schools/:schoolCode/results", resultsRouter);

export default router;
