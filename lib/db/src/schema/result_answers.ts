import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resultAnswersTable = pgTable("result_answers", {
  id: serial("id").primaryKey(),
  resultId: integer("result_id").notNull(),
  questionId: integer("question_id").notNull(),
  questionText: text("question_text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: text("correct_option").notNull(),
  selectedOption: text("selected_option"), // null if skipped
  isCorrect: boolean("is_correct").notNull().default(false),
  schoolCode: text("school_code").notNull(),
});

export const insertResultAnswerSchema = createInsertSchema(resultAnswersTable).omit({ id: true });
export type InsertResultAnswer = z.infer<typeof insertResultAnswerSchema>;
export type ResultAnswer = typeof resultAnswersTable.$inferSelect;
