import { pgTable, text, serial, integer, timestamp, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  studentId: integer("student_id").notNull(),
  fullName: text("full_name").notNull(),
  class: text("class").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: real("percentage").notNull(),
  schoolCode: text("school_code").notNull(),
  term: text("term").default("First Term"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
}, (table) => ({
  examIdIdx: index("results_exam_id_idx").on(table.examId),
  studentIdIdx: index("results_student_id_idx").on(table.studentId),
  schoolCodeIdx: index("results_school_code_idx").on(table.schoolCode),
}));

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true, submittedAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;
