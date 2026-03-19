import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListTeachers, useCreateTeacher, useDeleteTeacher, useListStudents, useCreateStudent, useDeleteStudent, useListResults, useStartNewSession } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, CustomTabs, Badge, Select } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListTeachersQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { Trash2, UserPlus, RotateCw, ChevronRight } from "lucide-react";
import { TeacherDetailModal } from "@/components/teacher-detail-modal";
import { StudentDetailModal } from "@/components/student-detail-modal";
import { ResultDetailModal } from "@/components/result-detail-modal";
import { format } from "date-fns";

export default function SchoolAdminDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [activeTab, setActiveTab] = useState("Teachers");
  const queryClient = useQueryClient();

  const [classFilter, setClassFilter] = useState("JSS1");
  const CLASSES = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  const { data: teachers = [] } = useListTeachers(schoolCode);
  const { data: students = [] } = useListStudents(schoolCode, { class: classFilter });
  const { data: results = [] } = useListResults(schoolCode);

  // Detail modal state
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null);
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [tUsername, setTUsername] = useState("");
  const [tPassword, setTPassword] = useState("");
  const [tFullName, setTFullName] = useState("");

  const [isStudentModalOpen, setStudentModalOpen] = useState(false);
  const [sUsername, setSUsername] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sFullName, setSFullName] = useState("");
  const [sClass, setSClass] = useState("JSS1");

  const [isSessionModalOpen, setSessionModalOpen] = useState(false);

  const { mutate: createTeacher, isPending: isCTPending } = useCreateTeacher({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(schoolCode) });
        setTeacherModalOpen(false);
        setTUsername(""); setTPassword(""); setTFullName("");
      }
    }
  });

  const { mutate: deleteTeacher } = useDeleteTeacher({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey(schoolCode) }) }
  });

  const { mutate: createStudent, isPending: isCSPending } = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, { class: classFilter }) });
        setStudentModalOpen(false);
        setSUsername(""); setSPassword(""); setSFullName("");
      }
    }
  });

  const { mutate: deleteStudent } = useDeleteStudent({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, { class: classFilter }) }) }
  });

  const { mutate: newSession, isPending: isNSPending } = useStartNewSession({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey(schoolCode, { class: classFilter }) });
        setSessionModalOpen(false);
      }
    }
  });

  return (
    <DashboardLayout allowedRoles={["school_admin"]}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">School Administration</h1>
          <p className="text-muted-foreground mt-1">Manage personnel, students, and academic records.</p>
        </div>
        <Button variant="outline" onClick={() => setSessionModalOpen(true)}>
          <RotateCw className="w-4 h-4 mr-2 text-primary" />
          Start New Session
        </Button>
      </div>

      <div className="mb-6">
        <CustomTabs tabs={["Teachers", "Students", "Results"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "Teachers" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
            <div>
              <h2 className="text-lg font-bold">Teacher Directory</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Click a row to view all exams and student results</p>
            </div>
            <Button size="sm" onClick={() => setTeacherModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Teacher
            </Button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map(t => (
                <tr
                  key={t.id}
                  className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => { setSelectedTeacherId(t.id); setSelectedTeacherName(t.fullName || t.username); }}
                >
                  <td className="px-6 py-4 font-semibold text-primary">{t.fullName}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{t.username}</td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); deleteTeacher({ schoolCode, teacherId: t.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No teachers found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "Students" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between items-center bg-muted/20 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-muted-foreground mr-2">Filter Class:</span>
                <CustomTabs tabs={CLASSES} activeTab={classFilter} onChange={setClassFilter} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click a student row to view their full exam history</p>
            </div>
            <Button size="sm" onClick={() => setStudentModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" /> Add Student
            </Button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr
                  key={s.id}
                  className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                  onClick={() => { setSelectedStudentId(s.id); setSelectedStudentName(s.fullName || s.username); }}
                >
                  <td className="px-6 py-4 font-semibold text-primary">{s.fullName}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{s.username}</td>
                  <td className="px-6 py-4"><Badge>{s.class}</Badge></td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => { e.stopPropagation(); deleteStudent({ schoolCode, studentId: s.id }); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No students in {classFilter}.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === "Results" && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground">Click any result row to view the full question & answer breakdown</p>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Student Name</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold">Exam Title</th>
                <th className="px-6 py-4 font-semibold">Score</th>
                <th className="px-6 py-4 font-semibold">Percentage</th>
                <th className="px-6 py-4 font-semibold text-center">Grade</th>
                <th className="px-6 py-4 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => {
                const pct = r.percentage ?? 0;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedResultId(r.id)}
                  >
                    <td className="px-6 py-4 font-semibold text-primary">{r.fullName}</td>
                    <td className="px-6 py-4"><Badge>{r.class}</Badge></td>
                    <td className="px-6 py-4 font-medium">{r.examTitle || r.subject}</td>
                    <td className="px-6 py-4 font-bold">{r.score} / {r.totalQuestions}</td>
                    <td className="px-6 py-4 font-semibold">{pct.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={pct >= 70 ? "success" : "destructive"}>
                        {pct >= 70 ? "Pass" : "Fail"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy h:mm a") : "—"}
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No results available yet.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add Teacher Modal */}
      <Modal isOpen={isTeacherModalOpen} onClose={() => setTeacherModalOpen(false)} title="Add New Teacher">
        <form onSubmit={e => { e.preventDefault(); createTeacher({ schoolCode, data: { username: tUsername, password: tPassword, fullName: tFullName }}); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={tFullName} onChange={e => setTFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={tUsername} onChange={e => setTUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={tPassword} onChange={e => setTPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full mt-2" isLoading={isCTPending}>Create Teacher</Button>
        </form>
      </Modal>

      {/* Add Student Modal */}
      <Modal isOpen={isStudentModalOpen} onClose={() => setStudentModalOpen(false)} title="Add New Student">
        <form onSubmit={e => { e.preventDefault(); createStudent({ schoolCode, data: { username: sUsername, password: sPassword, fullName: sFullName, class: sClass }}); }} className="space-y-4">
          <div><Label>Full Name</Label><Input value={sFullName} onChange={e => setSFullName(e.target.value)} required /></div>
          <div><Label>Username</Label><Input value={sUsername} onChange={e => setSUsername(e.target.value)} required /></div>
          <div><Label>Password</Label><Input type="password" value={sPassword} onChange={e => setSPassword(e.target.value)} required /></div>
          <div>
            <Label>Class</Label>
            <Select value={sClass} onChange={e => setSClass(e.target.value)}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Button type="submit" className="w-full mt-2" isLoading={isCSPending}>Create Student</Button>
        </form>
      </Modal>

      {/* New Session Modal */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Start New Academic Session">
        <div className="space-y-4 text-muted-foreground">
          <p>Are you sure you want to start a new academic session?</p>
          <p className="text-destructive font-bold">This will automatically promote all students to their next class (e.g. JSS1 to JSS2). SSS3 students will be graduated.</p>
          <div className="flex justify-end pt-4">
            <Button variant="ghost" onClick={() => setSessionModalOpen(false)} className="mr-3">Cancel</Button>
            <Button variant="destructive" onClick={() => newSession({ schoolCode })} isLoading={isNSPending}>Yes, Promote Students</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modals */}
      <TeacherDetailModal
        teacherId={selectedTeacherId}
        teacherName={selectedTeacherName}
        schoolCode={schoolCode}
        onClose={() => setSelectedTeacherId(null)}
      />

      <StudentDetailModal
        studentId={selectedStudentId}
        studentName={selectedStudentName}
        schoolCode={schoolCode}
        onClose={() => setSelectedStudentId(null)}
      />

      <ResultDetailModal
        resultId={selectedResultId}
        schoolCode={schoolCode}
        onClose={() => setSelectedResultId(null)}
      />
    </DashboardLayout>
  );
}
