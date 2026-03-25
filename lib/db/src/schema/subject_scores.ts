import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const subjectScoresTable = pgTable("subject_scores", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    subjectName: text("subject_name").notNull(),
    className: text("class_name").notNull(),
    schoolCode: text("school_code").notNull(),

    // Three components (null means not yet entered)
    midTermScore: integer("mid_term_score"),
    classActivityScore: integer("class_activity_score"),
    examScore: integer("exam_score"),

    // Calculated fields
    totalScore: integer("total_score"),
    percentage: integer("percentage"),
    grade: text("grade"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uniqueStudentSubject: unique().on(table.studentId, table.subjectName),
}));

export const insertSubjectScoreSchema = createInsertSchema(subjectScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubjectScore = typeof subjectScoresTable.$inferInsert;
export type SubjectScore = typeof subjectScoresTable.$inferSelect;