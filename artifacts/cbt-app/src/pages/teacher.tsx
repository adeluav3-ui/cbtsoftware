import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListExams, useCreateExam, useDeleteExam, useToggleExamStatus, useListResults } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Select, CustomTabs, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getListExamsQueryKey } from "@workspace/api-client-react";
import { BookOpen, Plus, Settings, Trash2, Power, PowerOff, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ResultDetailModal } from "@/components/result-detail-modal";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("My Exams");
  const CLASSES = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

  const { data: exams = [], isLoading } = useListExams(schoolCode);

  // Fetch all results then filter to this teacher's exams client-side
  const teacherExamIds = new Set(exams.map(e => e.id));
  const { data: allResults = [], isLoading: resultsLoading } = useListResults(schoolCode, {}, {
    query: { enabled: activeTab === "Results" && exams.length > 0 }
  });
  const results = allResults.filter(r => r.examId !== undefined && teacherExamIds.has(r.examId));

  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);

  const [isExamModalOpen, setExamModalOpen] = useState(false);
  const [eTitle, setETitle] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eClass, setEClass] = useState("JSS1");
  const [eDuration, setEDuration] = useState("45");

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
    createExam({ schoolCode, data: { title: eTitle, subject: eSubject, class: eClass, durationMinutes: parseInt(eDuration) } });
  };

  return (
    <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Teacher Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your exams and student progress.</p>
        </div>
        <Button onClick={() => setExamModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Exam
        </Button>
      </div>

      <div className="mb-6">
        <CustomTabs tabs={["My Exams", "Results"]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "My Exams" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map(exam => (
            <Card key={exam.id} className="flex flex-col group hover:border-primary/30">
              <div className="flex justify-between items-start mb-4">
                <Badge variant={exam.isActive ? "success" : "default"}>
                  {exam.isActive ? "Active" : "Draft"}
                </Badge>
                <div className="flex space-x-1">
                  <button onClick={() => toggleStatus({ schoolCode, examId: exam.id, data: { isActive: !exam.isActive }})} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Toggle Status">
                    {exam.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                  </button>
                  <button onClick={() => deleteExam({ schoolCode, examId: exam.id })} className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete">
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
                className="w-full mt-4" 
                onClick={() => setLocation(`/teacher/exams/${exam.id}`)}
              >
                <Settings className="w-4 h-4 mr-2" /> Manage Questions
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

      {activeTab === "Results" && (
        <>
          {resultsLoading ? (
            <Card className="p-12 text-center text-muted-foreground">Loading results...</Card>
          ) : results.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold text-lg">No results yet.</p>
              <p className="text-sm mt-1">Results will appear here once students submit your exams.</p>
            </div>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-sm text-muted-foreground">
                      <th className="px-5 py-4 font-semibold">Student Name</th>
                      <th className="px-5 py-4 font-semibold">Class</th>
                      <th className="px-5 py-4 font-semibold">Exam</th>
                      <th className="px-5 py-4 font-semibold">Subject</th>
                      <th className="px-5 py-4 font-semibold text-center">Score</th>
                      <th className="px-5 py-4 font-semibold text-center">%</th>
                      <th className="px-5 py-4 font-semibold text-center">Grade</th>
                      <th className="px-5 py-4 font-semibold">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => {
                      const pct = r.percentage ?? 0;
                      const grade = pct >= 70 ? "Pass" : "Fail";
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-border/40 hover:bg-primary/5 transition-colors cursor-pointer"
                          onClick={() => setSelectedResultId(r.id)}
                          title="Click to view full answer breakdown"
                        >
                          <td className="px-5 py-3.5 font-semibold text-primary underline-offset-2 hover:underline">{r.fullName}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{r.class}</td>
                          <td className="px-5 py-3.5 font-medium">{r.examTitle || "—"}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{r.subject || "—"}</td>
                          <td className="px-5 py-3.5 text-center font-bold">{r.score}/{r.totalQuestions}</td>
                          <td className="px-5 py-3.5 text-center font-semibold">{pct.toFixed(1)}%</td>
                          <td className="px-5 py-3.5 text-center">
                            <Badge variant={pct >= 70 ? "success" : "destructive"}>{grade}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground text-sm">
                            {r.submittedAt ? format(new Date(r.submittedAt), "MMM d, yyyy h:mm a") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

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
          </div>
          <Button type="submit" className="w-full mt-4" isLoading={isCEPending}>Create Exam</Button>
        </form>
      </Modal>

      <ResultDetailModal
        resultId={selectedResultId}
        schoolCode={schoolCode}
        onClose={() => setSelectedResultId(null)}
      />
    </DashboardLayout>
  );
}
