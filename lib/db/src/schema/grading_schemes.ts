import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const gradingSchemesTable = pgTable("grading_schemes", {
    id: serial("id").primaryKey(),
    schoolCode: text("school_code").notNull(),

    // Component totals
    midTermTotal: integer("mid_term_total").notNull().default(20),
    midTermCbt: integer("mid_term_cbt").notNull().default(10),
    midTermTheory: integer("mid_term_theory").notNull().default(10),
    examTotal: integer("exam_total").notNull().default(60),
    examCbt: integer("exam_cbt").notNull().default(30),
    examTheory: integer("exam_theory").notNull().default(30),
    classActivityTotal: integer("class_activity_total").notNull().default(20),

    // Grade ranges
    gradeAMin: integer("grade_a_min").notNull().default(70),
    gradeBMin: integer("grade_b_min").notNull().default(60),
    gradeCMin: integer("grade_c_min").notNull().default(50),
    gradeDMin: integer("grade_d_min").notNull().default(40),
    gradeFMax: integer("grade_f_max").notNull().default(39),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGradingSchemeSchema = createInsertSchema(gradingSchemesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGradingScheme = typeof gradingSchemesTable.$inferInsert;
export type GradingScheme = typeof gradingSchemesTable.$inferSelect;