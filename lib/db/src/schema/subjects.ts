import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const subjectsTable = pgTable("subjects", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    level: text("level").notNull(), // 'junior' or 'senior'
    schoolCode: text("school_code").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    uniqueSubject: unique("subjects_name_school_code_level_unique").on(table.name, table.level, table.schoolCode),
}));

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({ id: true, createdAt: true });
export type InsertSubject = typeof subjectsTable.$inferInsert;
export type Subject = typeof subjectsTable.$inferSelect;