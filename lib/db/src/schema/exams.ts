import { pgTable, text, serial, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  class: text("class").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  schoolCode: text("school_code").notNull(),
  teacherId: integer("teacher_id").notNull(),
  assessmentType: text("assessment_type").default("exam"),
  term: text("term").default("First Term"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  schoolCodeIdx: index("exams_school_code_idx").on(table.schoolCode),
  teacherIdIdx: index("exams_teacher_id_idx").on(table.teacherId),
  schoolActiveIdx: index("exams_school_active_idx").on(table.schoolCode, table.isActive),
}));

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  text: text("text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: text("correct_option").notNull(), // A, B, C, D
  schoolCode: text("school_code").notNull(),
  imageUrl: text("image_url"),
  groupId: integer("group_id"), // Add this
  groupOrder: integer("group_order").default(0), // Add this
  groupImageUrl: text("group_image_url"), // Add this
}, (table) => ({
  examIdIdx: index("questions_exam_id_idx").on(table.examId),
}));

export const insertExamSchema = createInsertSchema(examsTable).omit({ id: true, createdAt: true });
export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true });
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
