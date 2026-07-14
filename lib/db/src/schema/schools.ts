import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique("schools_code_key"),
  name: text("name"),
  logoUrl: text("logo_url"),
  retakePasscode: text("retake_passcode").default("1234"),
  currentAcademicSession: text("current_academic_session").default("2025/2026"),
  currentTerm: text("current_term").default("First Term"),
  availableTerms: text("available_terms").array().default(["First Term", "Second Term", "Third Term"]),
  nextTermBegins: text("next_term_begins"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  licenseValidUntil: timestamp("license_valid_until"),
  maxDevices: integer("max_devices"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({ id: true, createdAt: true });
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;