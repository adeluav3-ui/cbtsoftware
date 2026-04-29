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
import { BookOpen, Plus, Settings, Trash2, Power, PowerOff, ClipboardList, Users, UserPlus, Upload } from "lucide-react";
import { format } from "date-fns";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { EnterScoresModal } from "@/components/enter-scores-modal";
import { StudentResultsModal } from "@/components/student-results-modal";
import { BulkUploadStudentsModal } from "@/components/bulk-upload-students-modal";

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
  const CLASSES = ["Pry 1", "Pry 2", "Pry 3", "Pry 4", "Pry 5", "JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  // ── Exams ────────────────────────────────────────
  const { data: exams = [], isLoading } = useListExams(schoolCode);

  const [isExamModalOpen, setExamModalOpen] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eClass, setEClass] = useState("JSS1");
  const [eDuration, setEDuration] = useState("45");
  const [eAssessmentType, setEAssessmentType] = useState("exam");
  const [bulkStudentModalOpen, setBulkStudentModalOpen] = useState(false);

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
  const [subjects, setSubjects] = useState<{ id: number; name: string; level: string }[]>([]);
  const [currentTerm, setCurrentTerm] = useState("First Term");

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
    createExam({
      schoolCode, data: {
        title: eTitle, subject: eSubject, class: eClass, durationMinutes: parseInt(eDuration), assessmentType: eAssessmentType,
        term: currentTerm
      }
    });
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

  const fetchSubjects = async (level: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/subjects?level=${level}`,
        { credentials: "include" }
      );
      const data = await response.json();
      setSubjects(data);
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    }
  };

  // Fetch school info to get current term
  useEffect(() => {
    const fetchSchoolInfo = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}`, {
          credentials: "include",
        });
        const data = await response.json();
        setCurrentTerm(data.currentTerm || "First Term");
      } catch (err) {
        console.error("Failed to fetch school info", err);
      }
    };
    if (schoolCode) fetchSchoolInfo();
  }, [schoolCode]);

  // Fetch subject scores
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

  // Determine level based on selected class
  useEffect(() => {
    if (eClass && schoolCode) {
      let level = 'primary';
      if (eClass.startsWith('JSS')) level = 'junior';
      else if (eClass.startsWith('SSS')) level = 'senior';
      fetchSubjects(level);
    }
  }, [eClass, schoolCode]);

  // Fetch subject scores on mount
  useEffect(() => {
    if (schoolCode) {
      fetchSubjectScores();
    }
  }, [schoolCode]);

  return (
    <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your exams, students, and results.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setLocation("/comprehensive-results")} className="w-full sm:w-auto">
            <ClipboardList className="w-4 h-4 mr-2" /> Results
          </Button>
          {activeTab === "My Exams" && (
            <Button onClick={() => setExamModalOpen(true)} size="sm" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" /> Create Exam
            </Button>
          )}
          {activeTab === "Students" && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => setBulkStudentModalOpen(true)} className="flex-1 sm:flex-none">
                <Upload className="w-4 h-4 mr-1" /> Bulk
              </Button>
              <Button size="sm" onClick={() => setStudentModalOpen(true)} className="flex-1 sm:flex-none">
                <UserPlus className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div className="mb-6 overflow-x-auto pb-2">
        <CustomTabs tabs={["My Exams", "Students", "Results"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── My Exams Tab ──────────────────────────────── */}
      {activeTab === "My Exams" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {exams.map(exam => (
            <Card key={exam.id} className="flex flex-col p-4 md:p-6">
              <div className="flex justify-between items-start mb-3">
                <Badge variant={exam.isActive ? "success" : "default"} className="text-xs">
                  {exam.isActive ? "Active" : "Draft"}
                </Badge>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleStatus({ schoolCode, examId: exam.id, isActive: !exam.isActive })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    title="Toggle Status"
                  >
                    {exam.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                  </button>
                  <button
                    onClick={() => deleteExam({ schoolCode, examId: exam.id })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg md:text-xl font-bold font-display mb-1">{exam.title}</h3>
              <p className="text-primary font-semibold text-xs md:text-sm mb-3">{exam.subject} • {exam.class}</p>
              <div className="flex justify-between text-xs text-muted-foreground mt-auto pt-3 border-t border-border/50">
                <span>{exam.durationMinutes} mins</span>
                <span>{exam.questionCount || 0} Questions</span>
              </div>
              <Button variant="secondary" size="sm" className="w-full mt-2" onClick={() => setLocation(`/teacher/exams/${exam.id}`)}>
                <Settings className="w-4 h-4 mr-2" /> Manage
              </Button>
              <Button variant="secondary" size="sm" className="w-full mt-2" onClick={() => setLocation(`/teacher/exams/${exam.id}/results`)}>
                <ClipboardList className="w-4 h-4 mr-2" /> Results
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
          <div className="p-4 border-b border-border/50 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-muted-foreground">Class:</span>
                <div className="overflow-x-auto pb-1">
                  <div className="flex gap-1">
                    {CLASSES.map(c => (
                      <button
                        key={c}
                        onClick={() => setClassFilter(c)}
                        className={`px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${classFilter === c ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {studentsLoading ? "Loading…" : `${students.length} student${students.length !== 1 ? "s" : ""} in ${classFilter}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkStudentModalOpen(true)} className="flex-1 sm:flex-none">
                <Upload className="w-4 h-4 mr-1" /> Bulk
              </Button>
              <Button size="sm" onClick={() => setStudentModalOpen(true)} className="flex-1 sm:flex-none">
                <UserPlus className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-150 text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Username</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center">Loading…</td></tr>
                ) : students.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-muted-foreground">No students in {classFilter} yet.</p>
                  </td></tr>
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
                      <td className="px-4 py-3 font-semibold text-primary">{s.fullName}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{s.username}</td>
                      <td className="px-4 py-3"><Badge>{s.class}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteStudent({ schoolCode, studentId: s.id });
                          }}
                          className="p-1"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Results Tab ───────────────────────────────── */}
      {activeTab === "Results" && (
        <Card className="p-4 md:p-6">
          <div className="mb-4">
            <h3 className="text-base md:text-lg font-semibold">Student Results by Class</h3>
            <p className="text-xs text-muted-foreground">Tap on any student to view their complete results</p>
          </div>

          <div className="space-y-6">
            {CLASSES.map(className => {
              const classStudents = students.filter((s: Student) => s.class === className);
              if (classStudents.length === 0) return null;

              return (
                <div key={className}>
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-lg md:text-xl font-bold font-display text-primary">{className}</h4>
                    <Badge variant="default" className="text-xs">{classStudents.length}</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-150 text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="px-3 py-2 font-semibold">Student</th>
                          <th className="px-3 py-2 font-semibold">Username</th>
                          <th className="px-3 py-2 font-semibold text-center">Subj</th>
                          <th className="px-3 py-2 font-semibold text-center">Comp</th>
                          <th className="px-3 py-2 font-semibold text-center">Avg %</th>
                          <th className="px-3 py-2 font-semibold text-center">Status</th>
                          <th className="px-3 py-2 font-semibold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((student: Student) => {
                          const studentSubjectScores = subjectScores.filter((s: any) => s.studentId === student.id);
                          const completedSubjects = studentSubjectScores.filter((s: any) => {
                            return s.midTermScore !== null && s.classActivityScore !== null && s.examScore !== null;
                          });
                          let overallAvg = 0;
                          if (completedSubjects.length > 0) {
                            const totalPercentages = completedSubjects.reduce((acc: number, s: any) => {
                              const totalScore = (s.midTermScore || 0) + (s.classActivityScore || 0) + (s.examScore || 0);
                              return acc + totalScore;
                            }, 0);
                            overallAvg = totalPercentages / completedSubjects.length;
                          }
                          return (
                            <tr key={student.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer">
                              <td className="px-3 py-2 font-semibold text-primary" onClick={() => { setSelectedStudentId(student.id); setSelectedStudentName(student.fullName || student.username); setSelectedStudentClass(student.class); setStudentResultsModalOpen(true); }}>
                                {student.fullName}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground text-xs" onClick={() => { setSelectedStudentId(student.id); setSelectedStudentName(student.fullName || student.username); setSelectedStudentClass(student.class); setStudentResultsModalOpen(true); }}>
                                {student.username}
                              </td>
                              <td className="px-3 py-2 text-center">{studentSubjectScores.length}</td>
                              <td className="px-3 py-2 text-center">{completedSubjects.length}</td>
                              <td className="px-3 py-2 text-center font-bold">
                                {completedSubjects.length > 0 ? (
                                  <span className={overallAvg >= 70 ? "text-green-600" : "text-destructive"}>
                                    {overallAvg.toFixed(0)}%
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Badge variant={overallAvg >= 70 ? "success" : completedSubjects.length > 0 ? "warning" : "default"} className="text-xs">
                                  {overallAvg >= 70 ? "Pass" : completedSubjects.length > 0 ? "Progress" : "None"}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <Button variant="secondary" size="sm" className="p-1.5" onClick={() => { setSelectedStudentId(student.id); setSelectedStudentName(student.fullName || student.username); setSelectedStudentClass(student.class); setStudentResultsModalOpen(true); }}>
                                  <ClipboardList className="w-4 h-4" />
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
              <div className="text-center py-12 text-muted-foreground">No students enrolled yet.</div>
            )}
          </div>
        </Card>
      )}

      {/* Modals - unchanged from original */}
      <Modal isOpen={isExamModalOpen} onClose={() => setExamModalOpen(false)} title="Create New Exam">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><Label>Exam Title</Label><Input value={eTitle} onChange={e => setETitle(e.target.value)} placeholder="e.g. Mid-Term Test" required /></div>
          <div>
            <Label>Subject</Label>
            <Select value={eSubject} onChange={e => setESubject(e.target.value)} required>
              <option value="">Select a subject</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.name}>{subject.name}</option>
              ))}
            </Select>
            {subjects.length === 0 && eClass && (
              <p className="text-xs text-yellow-600 mt-1">No subjects added for this class level. Ask the school admin to add subjects.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Class</Label><Select value={eClass} onChange={e => setEClass(e.target.value)}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select></div>
            <div><Label>Duration (Minutes)</Label><Input type="number" min="1" value={eDuration} onChange={e => setEDuration(e.target.value)} required /></div>
            <div className="col-span-2"><Label>Assessment Type</Label><Select value={eAssessmentType} onChange={e => setEAssessmentType(e.target.value)}>
              <option value="mid_term">Mid-Term Test</option>
              <option value="exam">Final Exam</option>
              <option value="class_activity">Class Activity</option>
            </Select></div>
          </div>
          <Button type="submit" className="w-full mt-4" isLoading={isCEPending}>Create Exam</Button>
        </form>
      </Modal>

      <Modal isOpen={isStudentModalOpen} onClose={() => setStudentModalOpen(false)} title="Enrol New Student">
        <form onSubmit={e => { e.preventDefault(); createStudent({ schoolCode, data: { username: sUsername, password: sPassword, fullName: sFullName, class: sClass } }); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={sFullName} onChange={e => setSFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={sUsername} onChange={e => setSUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={sPassword} onChange={e => setSPassword(e.target.value)} required /></div>
          <div><Label>Class</Label><Select value={sClass} onChange={e => setSClass(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select></div>
          <Button type="submit" className="w-full mt-2" isLoading={isCSPending}>Enrol Student</Button>
        </form>
      </Modal>

      <ResultDetailModal resultId={selectedResultId} schoolCode={schoolCode} onClose={() => setSelectedResultId(null)} />

      {selectedStudentForScores && (
        <EnterScoresModal isOpen={scoresModalOpen} onClose={() => { setScoresModalOpen(false); setSelectedStudentForScores(null); }} examId={selectedStudentForScores.examId} examTitle={selectedStudentForScores.examTitle} assessmentType={selectedStudentForScores.assessmentType} studentId={selectedStudentForScores.studentId} studentName={selectedStudentForScores.studentName} schoolCode={schoolCode} existingTheoryScore={selectedStudentForScores.theoryScore} existingActivityScore={selectedStudentForScores.activityScore} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["results", schoolCode] }); fetchSubjectScores(); }} />
      )}

      <BulkUploadStudentsModal isOpen={bulkStudentModalOpen} onClose={() => setBulkStudentModalOpen(false)} schoolCode={schoolCode} onSuccess={() => { queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, classFilter) }); }} />

      <StudentResultsModal isOpen={studentResultsModalOpen} onClose={() => setStudentResultsModalOpen(false)} studentId={selectedStudentId !== null ? selectedStudentId : 0} studentName={selectedStudentName} studentClass={selectedStudentClass} schoolCode={schoolCode} onScoresUpdated={() => { fetchSubjectScores(); }} />
    </DashboardLayout>
  );
}