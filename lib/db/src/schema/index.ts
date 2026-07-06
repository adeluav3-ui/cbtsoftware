export * from "./schools.js";
export * from "./users.js";
export * from "./exams.js";
export * from "./results.js";
export * from "./result_answers.js";
export * from "./grading_schemes.js";
export * from "./subject_scores.js";
export * from "./subjects.js";
export * from "./student_traits.js";
export * from "./student_attendance.js";
export * from "./device_sessions.js";

// Export grading schemes explicitly
export { gradingSchemesTable, insertGradingSchemeSchema, type InsertGradingScheme, type GradingScheme } from "./grading_schemes.js";

// Export subject scores explicitly
export { subjectScoresTable, insertSubjectScoreSchema, type InsertSubjectScore, type SubjectScore } from "./subject_scores.js";

// Export subjects explicitly
export { subjectsTable, insertSubjectSchema, type InsertSubject, type Subject } from "./subjects.js";