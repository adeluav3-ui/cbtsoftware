import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: [
    "./src/schema/schools.ts",
    "./src/schema/users.ts",
    "./src/schema/exams.ts",
    "./src/schema/results.ts",
    "./src/schema/result_answers.ts",
    "./src/schema/grading_schemes.ts",
    "./src/schema/subject_scores.ts",
    "./src/schema/subjects.ts",
    "./src/schema/student_scores.ts",
    "./src/schema/student_traits.ts",
    "./src/schema/student_attendance.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
