export * from "./schools.js";
export * from "./users.js";
export * from "./exams.js";
export * from "./results.js";
export * from "./result_answers.js";

// Export grading schemes
export {
    gradingSchemesTable,
    insertGradingSchemeSchema,
    type InsertGradingScheme,
    type GradingScheme
} from "./grading_schemes.js";

// Export student scores
export {
    studentScoresTable,
    insertStudentScoreSchema,
    type InsertStudentScore,
    type StudentScore
} from "./student_scores.js";