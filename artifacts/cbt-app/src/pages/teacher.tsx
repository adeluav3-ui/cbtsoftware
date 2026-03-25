import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import {
  useListExams, useCreateExam, useDeleteExam, useToggleExamStatus,
  useListResults, useListStudents, useCreateStudent, useDeleteStudent,
} from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Select, CustomTabs, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListExamsQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { BookOpen, Plus, Settings, Trash2, Power, PowerOff, ClipboardList, Users, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { EnterScoresModal } from "@/components/enter-scores-modal";
import { StudentResultsModal } from "@/components/student-results-modal";

interface Student {
  id: number;
  fullName: string;
  username: string;
  class: string;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("My Exams");
  const CLASSES = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  // ── Exams ────────────────────────────────────────
  const { data: exams = [], isLoading } = useListExams(schoolCode);

  const [isExamModalOpen, setExamModalOpen] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eClass, setEClass] = useState("JSS1");
  const [eDuration, setEDuration] = useState("45");
  const [eAssessmentType, setEAssessmentType] = useState("exam");

  // Scores modal state
  const [scoresModalOpen, setScoresModalOpen] = useState(false);
  const [selectedStudentForScores, setSelectedStudentForScores] = useState<{
    studentId: number;
    studentName: string;
    examId: number;
    examTitle: string;
    assessmentType: string;
    theoryScore: number;
    activityScore: number;
  } | null>(null);

  // Student detail modal state
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [selectedStudentClass, setSelectedStudentClass] = useState("");
  const [studentResultsModalOpen, setStudentResultsModalOpen] = useState(false);
  const [subjectScores, setSubjectScores] = useState<any[]>([]);

  const { mutate: createExam, isPending: isCEPending } = useCreateExam({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey(schoolCode) });
        setExamModalOpen(false);
        setETitle(""); setESubject(""); setEDuration("45");
      }
    }
  });

  const { mutate: deleteExam } = useDeleteExam({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExamsQueryKey(schoolCode) }) }
  });

  const { mutate: toggleStatus } = useToggleExamStatus({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListExamsQueryKey(schoolCode) }) }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createExam({ schoolCode, data: { title: eTitle, subject: eSubject, class: eClass, durationMinutes: parseInt(eDuration), assessmentType: eAssessmentType } });
  };

  // ── Students ─────────────────────────────────────
  const [classFilter, setClassFilter] = useState("JSS1");
  const { data: students = [], isLoading: studentsLoading } = useListStudents(schoolCode, classFilter);

  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [sFullName, setSFullName] = useState("");
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sClass, setSClass] = useState("JSS1");

  const { mutate: createStudent, isPending: isCSPending } = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) });
        setStudentModalOpen(false);
        setSFullName(""); setSUsername(""); setSPassword(""); setSClass("JSS1");
      }
    }
  });

  const { mutate: deleteStudent } = useDeleteStudent({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) })
    }
  });

  // ── Results ───────────────────────────────────────
  const teacherExamIds = new Set(exams.map(e => e.id));
  const { data: allResults = [], isLoading: resultsLoading } = useListResults(schoolCode);
  const results = allResults.filter(r => r.examId !== undefined && teacherExamIds.has(r.examId));
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  // Fetch subject scores
  useEffect(() => {
    const fetchSubjectScores = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/subject-scores`, {
          credentials: "include",
        });
        const data = await response.json();
        setSubjectScores(data);
      } catch (err) {
        console.error("Failed to fetch subject scores", err);
      }
    };

    if (schoolCode) {
      fetchSubjectScores();
    }
  }, [schoolCode]);

  return (
    <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your exams, students, and results.</p>
        </div>
        {activeTab === "My Exams" && (
          <Button onClick={() => setExamModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Exam
          </Button>
        )}
        {activeTab === "Students" && (
          <Button onClick={() => setStudentModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Add Student
          </Button>
        )}
      </div>

      <div className="mb-6">
        <CustomTabs tabs={["My Exams", "Students", "Results"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── My Exams Tab ──────────────────────────────── */}
      {activeTab === "My Exams" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => (
            <Card key={exam.id} className="flex flex-col group hover:border-primary/30">
              <div className="flex justify-between items-start mb-4">
                <Badge variant={exam.isActive ? "success" : "default"}>
                  {exam.isActive ? "Active" : "Draft"}
                </Badge>
                <div className="flex space-x-1">
                  <button
                    onClick={() => toggleStatus({ schoolCode, examId: exam.id, isActive: !exam.isActive })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Toggle Status"
                  >
                    {exam.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                  </button>
                  <button
                    onClick={() => deleteExam({ schoolCode, examId: exam.id })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold font-display mb-1">{exam.title}</h3>
              <p className="text-primary font-semibold text-sm mb-4">{exam.subject} • {exam.class}</p>
              <div className="flex justify-between text-sm text-muted-foreground mt-auto pt-4 border-t border-border/50">
                <span>{exam.durationMinutes} mins</span>
                <span>{exam.questionCount || 0} Questions</span>
              </div>
              <Button
                variant="secondary"
                className="w-full mt-2"
                onClick={() => setLocation(`/teacher/exams/${exam.id}`)}
              >
                <Settings className="w-4 h-4 mr-2" /> Manage Questions
              </Button>
              <Button
                variant="secondary"
                className="w-full mt-2"
                onClick={() => setLocation(`/teacher/exams/${exam.id}/results`)}
              >
                <ClipboardList className="w-4 h-4 mr-2" /> View Results
              </Button>
            </Card>
          ))}
          {exams.length === 0 && !isLoading && (
            <div className="col-span-full py-16 text-center text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-lg">No exams created yet.</p>
              <p className="text-sm mt-1">Click "Create Exam" to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Students Tab ──────────────────────────────── */}
      {activeTab === "Students" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-muted-foreground">Class:</span>
                <CustomTabs tabs={CLASSES} activeTab={classFilter} onChange={val => setClassFilter(val)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {studentsLoading ? "Loading…" : `${students.length} student${students.length !== 1 ? "s" : ""} in ${classFilter}`}
              </p>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Full Name</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentsLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading students…</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-muted-foreground font-semibold">No students in {classFilter} yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">Click "Add Student" to enrol one.</p>
                  </td>
                </tr>
              ) : (
                students.map((s: Student) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setSelectedStudentName(s.fullName || s.username);
                      setSelectedStudentClass(s.class);
                      setStudentResultsModalOpen(true);
                    }}
                  >
                    <td className="px-6 py-4 font-semibold text-primary">{s.fullName}</td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{s.username}</td>
                    <td className="px-6 py-4"><Badge>{s.class}</Badge></td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteStudent({ schoolCode, studentId: s.id });
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Results Tab ───────────────────────────────── */}
      {activeTab === "Results" && (
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Student Results by Class</h3>
            <p className="text-sm text-muted-foreground">Click on any student to view their complete results</p>
          </div>

          <div className="space-y-8">
            {CLASSES.map(className => {
              const classStudents = students.filter((s: Student) => s.class === className);

              if (classStudents.length === 0) return null;

              return (
                <div key={className}>
                  <div className="flex items-center gap-3 mb-4">
                    <h4 className="text-xl font-bold font-display text-primary">{className}</h4>
                    <Badge variant="default">{classStudents.length} students</Badge>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                          <th className="px-4 py-3 font-semibold">Student Name</th>
                          <th className="px-4 py-3 font-semibold">Username</th>
                          <th className="px-4 py-3 font-semibold text-center">Subjects</th>
                          <th className="px-4 py-3 font-semibold text-center">Overall %</th>
                          <th className="px-4 py-3 font-semibold text-center">Status</th>
                          <th className="px-4 py-3 font-semibold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student: Student) => {
                          const studentSubjectScores = subjectScores.filter((s: any) => s.studentId === student.id);
                          const completedSubjects = studentSubjectScores.filter((s: any) => s.percentage !== null);
                          const overallAvg = completedSubjects.length > 0
                            ? completedSubjects.reduce((acc: number, s: any) => acc + (s.percentage || 0), 0) / completedSubjects.length
                            : 0;

                          return (
                            <tr key={student.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="px-4 py-3 font-semibold text-primary">
                                {student.fullName}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-sm">
                                {student.username}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {studentSubjectScores.length}
                              </td>
                              <td className="px-4 py-3 text-center font-bold">
                                {completedSubjects.length > 0 ? (
                                  <span className={overallAvg >= 70 ? "text-green-600" : "text-destructive"}>
                                    {overallAvg.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant={overallAvg >= 70 ? "success" : "default"}>
                                  {overallAvg >= 70 ? "Passing" : overallAvg > 0 ? "Needs Improvement" : "No Results"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudentId(student.id);
                                    setSelectedStudentName(student.fullName || student.username);
                                    setSelectedStudentClass(student.class);
                                    setStudentResultsModalOpen(true);
                                  }}
                                >
                                  <ClipboardList className="w-4 h-4 mr-1" /> View Results
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {students.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No students enrolled yet. Add students in the Students tab.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Create Exam Modal ────────────────────────── */}
      <Modal isOpen={isExamModalOpen} onClose={() => setExamModalOpen(false)} title="Create New Exam">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><Label>Exam Title</Label><Input value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="e.g. Mid-Term Test" required /></div>
          <div><Label>Subject</Label><Input value={eSubject} onChange={e => setESubject(e.target.value)} placeholder="e.g. Mathematics" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Class</Label>
              <Select value={eClass} onChange={e => setEClass(e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Duration (Minutes)</Label>
              <Input type="number" min="1" value={eDuration} onChange={e => setEDuration(e.target.value)} required />
            </div>
            <div>
              <Label>Assessment Type</Label>
              <Select value={eAssessmentType} onChange={e => setEAssessmentType(e.target.value)}>
                <option value="mid_term">Mid-Term Test</option>
                <option value="exam">Final Exam</option>
                <option value="class_activity">Class Activity</option>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {eAssessmentType === "mid_term" && "CBT + Theory scores (teacher enters theory)"}
                {eAssessmentType === "exam" && "CBT + Theory scores (teacher enters theory)"}
                {eAssessmentType === "class_activity" && "Only class activity score (teacher enters manually)"}
              </p>
            </div>
          </div>
          <Button type="submit" className="w-full mt-4" isLoading={isCEPending}>Create Exam</Button>
        </form>
      </Modal>

      {/* ── Add Student Modal ────────────────────────── */}
      <Modal isOpen={isStudentModalOpen} onClose={() => setStudentModalOpen(false)} title="Enrol New Student">
        <form
          onSubmit={e => {
            e.preventDefault();
            createStudent({ schoolCode, data: { username: sUsername, password: sPassword, fullName: sFullName, class: sClass } });
          }}
          className="space-y-4"
        >
          <div><Label>Full Name</Label><Input value={sFullName} onChange={e => setSFullName(e.target.value)} placeholder="e.g. Amara Osei" required /></div>
          <div><Label>Username</Label><Input value={sUsername} onChange={e => setSUsername(e.target.value)} placeholder="e.g. amara.osei" required /></div>
          <div><Label>Password</Label><Input type="password" value={sPassword} onChange={e => setSPassword(e.target.value)} placeholder="Set a password" required /></div>
          <div>
            <Label>Class</Label>
            <Select value={sClass} onChange={e => setSClass(e.target.value)}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isCSPending}>Enrol Student</Button>
        </form>
      </Modal>

      <ResultDetailModal
        resultId={selectedResultId}
        schoolCode={schoolCode}
        onClose={() => setSelectedResultId(null)}
      />

      {/* Enter Scores Modal */}
      {selectedStudentForScores && (
        <EnterScoresModal
          isOpen={scoresModalOpen}
          onClose={() => {
            setScoresModalOpen(false);
            setSelectedStudentForScores(null);
          }}
          examId={selectedStudentForScores.examId}
          examTitle={selectedStudentForScores.examTitle}
          assessmentType={selectedStudentForScores.assessmentType}
          studentId={selectedStudentForScores.studentId}
          studentName={selectedStudentForScores.studentName}
          schoolCode={schoolCode}
          existingTheoryScore={selectedStudentForScores.theoryScore}
          existingActivityScore={selectedStudentForScores.activityScore}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["results", schoolCode] });
          }}
        />
      )}

      {/* Student Results Modal */}
      <StudentResultsModal
        isOpen={studentResultsModalOpen}
        onClose={() => setStudentResultsModalOpen(false)}
        studentId={selectedStudentId !== null ? selectedStudentId : 0}
        studentName={selectedStudentName}
        studentClass={selectedStudentClass}
        schoolCode={schoolCode}
      />
    </DashboardLayout>
  );
}