import { pgTable, serial, integer, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const studentAttendanceTable = pgTable("student_attendance", {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull(),
    schoolCode: text("school_code").notNull(),
    term: text("term").notNull().default("First Term"),
    academicSession: text("academic_session").notNull().default("2025/2026"),
    className: text("class_name").notNull(),
    timesSchoolOpened: integer("times_school_opened").notNull().default(0),
    timesPresent: integer("times_present").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    uniqueStudentTermSession: unique().on(table.studentId, table.term, table.academicSession),
    studentIdIdx: index("student_attendance_student_id_idx").on(table.studentId),
    schoolCodeIdx: index("student_attendance_school_code_idx").on(table.schoolCode),
}));

export const insertStudentAttendanceSchema = createInsertSchema(studentAttendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudentAttendance = typeof studentAttendanceTable.$inferInsert;
export type StudentAttendance = typeof studentAttendanceTable.$inferSelect;
