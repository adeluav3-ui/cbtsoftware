import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const subjectScoresTable = pgTable("student_scores", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    examId: integer("exam_id").notNull(),
    schoolCode: text("school_code").notNull(),
    theoryScore: integer("theory_score").default(0),
    classActivityScore: integer("class_activity_score").default(0),
    cbtScore: integer("cbt_score").default(0),
    totalScore: integer("total_score").default(0),
    percentage: integer("percentage").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uniqueStudentExam: unique().on(table.studentId, table.examId),
}));

export const insertStudentScoreSchema = createInsertSchema(subjectScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentScore = typeof subjectScoresTable.$inferInsert;
export type StudentScore = typeof subjectScoresTable.$inferSelect;