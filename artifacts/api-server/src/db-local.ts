// SQLite database module for the local offline server.
// The esbuild local build aliases @workspace/db and @workspace/db/schema
// to this file instead of the Postgres version.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as sqliteSchema from "../../../lib/db/src/schema.sqlite.js";
import { initDb } from "./local-init-db.js";

const dbPath = process.env.SQLITE_PATH ?? "./cbt-local.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Idempotent — creates tables only if they don't exist yet
initDb(sqlite);

export const db = drizzle(sqlite, { schema: sqliteSchema });
export const pool = undefined;

// SQLite table objects (correct type mapping for boolean/timestamp columns)
export const {
  schoolsTable,
  usersTable,
  examsTable,
  questionsTable,
  resultsTable,
  resultAnswersTable,
  gradingSchemesTable,
  subjectScoresTable,
  subjectsTable,
  studentTraitsTable,
  studentAttendanceTable,
  deviceSessionsTable,
} = sqliteSchema;

// Zod schemas from the Postgres schema — validation logic is dialect-agnostic
export {
  insertSchoolSchema,
  insertUserSchema,
  insertExamSchema,
  insertQuestionSchema,
  insertResultSchema,
  insertResultAnswerSchema,
  insertGradingSchemeSchema,
  insertSubjectScoreSchema,
  insertSubjectSchema,
  insertStudentTraitSchema,
  insertStudentAttendanceSchema,
} from "../../../lib/db/src/schema/index.js";

// TypeScript-only type re-exports
export type {
  InsertSchool, School,
  InsertUser, User,
  InsertExam, Exam,
  InsertQuestion, Question,
  InsertResult, Result,
  InsertResultAnswer, ResultAnswer,
  InsertGradingScheme, GradingScheme,
  InsertSubjectScore, SubjectScore,
  InsertSubject, Subject,
  InsertStudentTrait, StudentTrait,
  InsertStudentAttendance, StudentAttendance,
  InsertDeviceSession, DeviceSession,
} from "../../../lib/db/src/schema/index.js";
