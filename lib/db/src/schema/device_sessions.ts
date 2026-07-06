import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  schoolCode: text("school_code"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: integer("user_id"),
  username: text("username"),
  fullName: text("full_name"),
  role: text("role"),
  firstSeen: timestamp("first_seen").notNull().defaultNow(),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
});

export type InsertDeviceSession = typeof deviceSessionsTable.$inferInsert;
export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
