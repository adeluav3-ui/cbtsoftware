import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const studentTraitsTable = pgTable("student_traits", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    schoolCode: text("school_code").notNull(),
    term: text("term").notNull().default("First Term"),
    academicSession: text("academic_session").notNull().default("2025/2026"),
    className: text("class_name").notNull(),
    traitCategory: text("trait_category").notNull(), // 'affective' | 'psychomotor'
    traitName: text("trait_name").notNull(),
    rating: integer("rating"), // 1-5
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uniqueStudentTrait: unique().on(table.studentId, table.traitName, table.term, table.academicSession),
    studentIdIdx: index("student_traits_student_id_idx").on(table.studentId),
    schoolCodeIdx: index("student_traits_school_code_idx").on(table.schoolCode),
}));

export const insertStudentTraitSchema = createInsertSchema(studentTraitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentTrait = typeof studentTraitsTable.$inferInsert;
export type StudentTrait = typeof studentTraitsTable.$inferSelect;
