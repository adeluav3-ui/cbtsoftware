import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const subjectScoresTable = pgTable("subject_scores", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    subjectName: text("subject_name").notNull(),
    className: text("class_name").notNull(),
    schoolCode: text("school_code").notNull(),
    term: text("term").default("First Term"), // Add this
    academicSession: text("academic_session").default("2025/2026"),

    // Three components (null means not yet entered)
    midTermScore: integer("mid_term_score"),
    classActivityScore: integer("class_activity_score"),
    examScore: integer("exam_score"),

    // Calculated fields
    totalScore: integer("total_score"),
    percentage: integer("percentage"),
    grade: text("grade"),
    teacherComment: text("teacher_comment"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uniqueStudentSubject: unique().on(table.studentId, table.subjectName),
    studentIdIdx: index("subject_scores_student_id_idx").on(table.studentId),
    schoolCodeIdx: index("subject_scores_school_code_idx").on(table.schoolCode),
    schoolTermSessionIdx: index("subject_scores_school_term_session_idx").on(table.schoolCode, table.term, table.academicSession),
}));

export const insertSubjectScoreSchema = createInsertSchema(subjectScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubjectScore = typeof subjectScoresTable.$inferInsert;
export type SubjectScore = typeof subjectScoresTable.$inferSelect;