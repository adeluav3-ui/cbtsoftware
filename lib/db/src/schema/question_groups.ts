import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionGroupsTable = pgTable("question_groups", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  title: text("title").notNull(),
  passageText: text("passage_text"),
  imageUrl: text("image_url"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  examIdIdx: index("question_groups_exam_id_idx").on(table.examId),
}));

export const insertQuestionGroupSchema = createInsertSchema(questionGroupsTable).omit({ id: true, createdAt: true });
export type InsertQuestionGroup = z.infer<typeof insertQuestionGroupSchema>;
export type QuestionGroup = typeof questionGroupsTable.$inferSelect;
