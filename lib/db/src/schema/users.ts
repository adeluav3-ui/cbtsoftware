import { pgTable, text, serial, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull(), // super_admin, school_admin, teacher, student
  fullName: text("full_name").notNull(),
  schoolCode: text("school_code"), // null for super_admin
  class: text("class"), // only for students
  profilePicture: text("profile_picture"),
  generatedPassword: text("generated_password"),
  feesFullyPaid: boolean("fees_fully_paid").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  schoolCodeIdx: index("users_school_code_idx").on(table.schoolCode),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
