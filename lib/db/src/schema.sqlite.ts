import {
  sqliteTable,
  integer,
  text,
  real,
  unique,
  index,
  customType,
} from "drizzle-orm/sqlite-core";

// SQLite has no native array type — serialize/deserialize via JSON
const textArray = customType<{ data: string[]; driverData: string }>({
  dataType() { return "text"; },
  fromDriver(v: string): string[] {
    try { return JSON.parse(v); } catch { return []; }
  },
  toDriver(v: string[]): string { return JSON.stringify(v); },
});

// ── schools ───────────────────────────────────────────────────────────────────
export const schoolsTable = sqliteTable("schools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name"),
  logoUrl: text("logo_url"),
  retakePasscode: text("retake_passcode").default("1234"),
  currentAcademicSession: text("current_academic_session").default("2025/2026"),
  currentTerm: text("current_term").default("First Term"),
  availableTerms: textArray("available_terms").default(["First Term", "Second Term", "Third Term"]),
  nextTermBegins: text("next_term_begins"),
  isDisabled: integer("is_disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── users ─────────────────────────────────────────────────────────────────────
export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name").notNull(),
  schoolCode: text("school_code"),
  class: text("class"),
  profilePicture: text("profile_picture"),
  generatedPassword: text("generated_password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  schoolCodeIdx: index("users_school_code_idx").on(table.schoolCode),
}));

// ── exams ─────────────────────────────────────────────────────────────────────
export const examsTable = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  class: text("class").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  schoolCode: text("school_code").notNull(),
  teacherId: integer("teacher_id").notNull(),
  assessmentType: text("assessment_type").default("exam"),
  term: text("term").default("First Term"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  schoolCodeIdx: index("exams_school_code_idx").on(table.schoolCode),
  teacherIdIdx: index("exams_teacher_id_idx").on(table.teacherId),
  schoolActiveIdx: index("exams_school_active_idx").on(table.schoolCode, table.isActive),
}));

// ── questions ─────────────────────────────────────────────────────────────────
export const questionsTable = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull(),
  text: text("text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: text("correct_option").notNull(),
  schoolCode: text("school_code").notNull(),
  imageUrl: text("image_url"),
  groupId: integer("group_id"),
  groupOrder: integer("group_order").default(0),
  groupImageUrl: text("group_image_url"),
  groupTitle: text("group_title"),
  groupText: text("group_text"),
}, (table) => ({
  examIdIdx: index("questions_exam_id_idx").on(table.examId),
}));

// ── results ───────────────────────────────────────────────────────────────────
export const resultsTable = sqliteTable("results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("exam_id").notNull(),
  studentId: integer("student_id").notNull(),
  fullName: text("full_name").notNull(),
  class: text("class").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percentage: real("percentage").notNull(),
  schoolCode: text("school_code").notNull(),
  term: text("term").default("First Term"),
  retakeCount: integer("retake_count").default(0),
  submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  examIdIdx: index("results_exam_id_idx").on(table.examId),
  studentIdIdx: index("results_student_id_idx").on(table.studentId),
  schoolCodeIdx: index("results_school_code_idx").on(table.schoolCode),
  schoolExamIdx: index("results_school_exam_idx").on(table.schoolCode, table.examId),
  studentExamIdx: index("results_student_exam_idx").on(table.studentId, table.examId),
}));

// ── result_answers ────────────────────────────────────────────────────────────
export const resultAnswersTable = sqliteTable("result_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resultId: integer("result_id").notNull(),
  questionId: integer("question_id").notNull(),
  questionText: text("question_text").notNull(),
  optionA: text("option_a").notNull(),
  optionB: text("option_b").notNull(),
  optionC: text("option_c").notNull(),
  optionD: text("option_d").notNull(),
  correctOption: text("correct_option").notNull(),
  selectedOption: text("selected_option"),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull().default(false),
  schoolCode: text("school_code").notNull(),
}, (table) => ({
  resultIdIdx: index("result_answers_result_id_idx").on(table.resultId),
}));

// ── grading_schemes ───────────────────────────────────────────────────────────
export const gradingSchemesTable = sqliteTable("grading_schemes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  schoolCode: text("school_code").notNull(),
  midTermTotal: integer("mid_term_total").notNull().default(20),
  midTermCbt: integer("mid_term_cbt").notNull().default(10),
  midTermTheory: integer("mid_term_theory").notNull().default(10),
  examTotal: integer("exam_total").notNull().default(60),
  examCbt: integer("exam_cbt").notNull().default(30),
  examTheory: integer("exam_theory").notNull().default(30),
  classActivityTotal: integer("class_activity_total").notNull().default(20),
  gradeAMin: integer("grade_a_min").notNull().default(70),
  gradeBMin: integer("grade_b_min").notNull().default(60),
  gradeCMin: integer("grade_c_min").notNull().default(50),
  gradeDMin: integer("grade_d_min").notNull().default(40),
  gradeFMax: integer("grade_f_max").notNull().default(39),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ── subject_scores ────────────────────────────────────────────────────────────
export const subjectScoresTable = sqliteTable("subject_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  subjectName: text("subject_name").notNull(),
  className: text("class_name").notNull(),
  schoolCode: text("school_code").notNull(),
  term: text("term").default("First Term"),
  academicSession: text("academic_session").default("2025/2026"),
  midTermScore: integer("mid_term_score"),
  midTermCbtScore: integer("mid_term_cbt_score"),
  classActivityScore: integer("class_activity_score"),
  examScore: integer("exam_score"),
  examCbtScore: integer("exam_cbt_score"),
  totalScore: integer("total_score"),
  percentage: integer("percentage"),
  grade: text("grade"),
  teacherComment: text("teacher_comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueStudentSubjectTermSession: unique().on(table.studentId, table.subjectName, table.term, table.academicSession),
  studentIdIdx: index("subject_scores_student_id_idx").on(table.studentId),
  schoolCodeIdx: index("subject_scores_school_code_idx").on(table.schoolCode),
  schoolTermSessionIdx: index("subject_scores_school_term_session_idx").on(table.schoolCode, table.term, table.academicSession),
}));

// ── subjects ──────────────────────────────────────────────────────────────────
export const subjectsTable = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  level: text("level").notNull(),
  schoolCode: text("school_code").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueSubject: unique().on(table.name, table.schoolCode, table.level),
}));

// ── student_traits ────────────────────────────────────────────────────────────
export const studentTraitsTable = sqliteTable("student_traits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  schoolCode: text("school_code").notNull(),
  term: text("term").notNull().default("First Term"),
  academicSession: text("academic_session").notNull().default("2025/2026"),
  className: text("class_name").notNull(),
  traitCategory: text("trait_category").notNull(),
  traitName: text("trait_name").notNull(),
  rating: integer("rating"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueStudentTrait: unique().on(table.studentId, table.traitName, table.term, table.academicSession),
  studentIdIdx: index("student_traits_student_id_idx").on(table.studentId),
  schoolCodeIdx: index("student_traits_school_code_idx").on(table.schoolCode),
}));

// ── student_attendance ────────────────────────────────────────────────────────
export const studentAttendanceTable = sqliteTable("student_attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull(),
  schoolCode: text("school_code").notNull(),
  term: text("term").notNull().default("First Term"),
  academicSession: text("academic_session").notNull().default("2025/2026"),
  className: text("class_name").notNull(),
  timesSchoolOpened: integer("times_school_opened").notNull().default(0),
  timesPresent: integer("times_present").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  uniqueStudentTermSession: unique().on(table.studentId, table.term, table.academicSession),
  studentIdIdx: index("student_attendance_student_id_idx").on(table.studentId),
  schoolCodeIdx: index("student_attendance_school_code_idx").on(table.schoolCode),
}));
