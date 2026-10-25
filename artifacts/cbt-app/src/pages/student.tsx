import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListExams, useListResults } from "@workspace/api-client-react";
import { Card, Button, Badge, Modal, Input, CustomTabs } from "@/components/ui-elements";
import { getGradeColor } from "@/lib/grade";
import { useLocation } from "wouter";
import { Clock, CheckCircle2, PlayCircle, RotateCcw, ClipboardList, BookOpen, TrendingUp, History } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const schoolCode = user?.schoolCode || "";
  const studentClass = user?.class || "";

  const { data: rawExams, isLoading } = useListExams(schoolCode, { active: true, class: studentClass });
  const { data: rawResults, refetch: refetchResults } = useListResults(schoolCode, { studentId: user?.id });
  const exams = Array.isArray(rawExams) ? rawExams : [];
  const results = Array.isArray(rawResults) ? rawResults : [];

  const [activeTab, setActiveTab] = useState("This Term");

  // Past results
  const [pastTerms, setPastTerms] = useState<{ term: string; academicSession: string }[]>([]);
  const [selectedPastTerm, setSelectedPastTerm] = useState<{ term: string; academicSession: string } | null>(null);
  const [pastSubjects, setPastSubjects] = useState<any[]>([]);
  const [isLoadingPastResults, setIsLoadingPastResults] = useState(false);
  const [pastGradeScheme, setPastGradeScheme] = useState({ gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 });

  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: number; title: string } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [retakeError, setRetakeError] = useState("");
  const [isRetaking, setIsRetaking] = useState(false);

  // Term results summary
  const [termSubjects, setTermSubjects] = useState<any[]>([]);
  const [isLoadingTermResults, setIsLoadingTermResults] = useState(false);
  const [gradeScheme, setGradeScheme] = useState({ gradeAMin: 70, gradeBMin: 60, gradeCMin: 50, gradeDMin: 40 });

  useEffect(() => {
    if (schoolCode && user?.id) {
      fetchTermResults();
      fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/grading-scheme`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            const scheme = { gradeAMin: d.gradeAMin ?? 70, gradeBMin: d.gradeBMin ?? 60, gradeCMin: d.gradeCMin ?? 50, gradeDMin: d.gradeDMin ?? 40 };
            setGradeScheme(scheme);
            setPastGradeScheme(scheme);
          }
        })
        .catch(() => {});
      // Fetch list of past terms
      fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${user.id}/past-terms`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(d => { if (Array.isArray(d)) setPastTerms(d); })
        .catch(() => {});
    }
  }, [schoolCode, user?.id]);

  const fetchTermResults = async () => {
    setIsLoadingTermResults(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${user!.id}/subject-scores`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setTermSubjects(data);
      else setTermSubjects([]);
    } catch (_) {} finally {
      setIsLoadingTermResults(false);
    }
  };

  const fetchPastResults = async (term: string, academicSession: string) => {
    setIsLoadingPastResults(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/students/${user!.id}/past-subject-scores?term=${encodeURIComponent(term)}&academicSession=${encodeURIComponent(academicSession)}`,
        { credentials: "include" }
      );
      if (!res.ok) { setPastSubjects([]); return; }
      const data = await res.json();
      if (Array.isArray(data)) setPastSubjects(data);
      else setPastSubjects([]);
    } catch (_) { setPastSubjects([]); } finally {
      setIsLoadingPastResults(false);
    }
  };

  const takenExamIds = new Set(results.map(r => r.examId));
  const availableExams = exams.filter(e => !takenExamIds.has(e.id));

  const handleRetakeRequest = async () => {
    if (!selectedExam || !user) return;
    setIsRetaking(true);
    setRetakeError("");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${selectedExam.id}/retake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.id, passcode }),
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) {
        setRetakeError(data.error || "Invalid passcode.");
        return;
      }
      await refetchResults();
      setRetakeModalOpen(false);
      setPasscode("");
      setSelectedExam(null);
    } catch (err) {
      setRetakeError("Network error.");
    } finally {
      setIsRetaking(false);
    }
  };

  const openRetakeModal = (examId: number, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setPasscode("");
    setRetakeError("");
    setRetakeModalOpen(true);
  };

  return (
    <DashboardLayout allowedRoles={["student"]}>
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Student Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Class: <span className="font-semibold text-primary">{studentClass}</span></p>
      </div>

      <div className="mb-6 overflow-x-auto pb-2">
        <CustomTabs
          tabs={["This Term", "Past Results"]}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            if (tab === "Past Results" && pastTerms.length > 0 && !selectedPastTerm) {
              setSelectedPastTerm(pastTerms[0]);
              fetchPastResults(pastTerms[0].term, pastTerms[0].academicSession);
            }
          }}
        />
      </div>

      {activeTab === "Past Results" && (
        <div>
          {pastTerms.length === 0 ? (
            <Card className="py-12 text-center text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No previous term results</p>
              <p className="text-sm mt-1">Results from past terms will appear here after your school advances to a new term.</p>
            </Card>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {pastTerms.map((t) => (
                  <button
                    key={`${t.term}-${t.academicSession}`}
                    onClick={() => {
                      setSelectedPastTerm(t);
                      fetchPastResults(t.term, t.academicSession);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${selectedPastTerm?.term === t.term && selectedPastTerm?.academicSession === t.academicSession ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {t.term} — {t.academicSession}
                  </button>
                ))}
              </div>

              {isLoadingPastResults ? (
                <Card className="py-8 text-center text-muted-foreground">Loading past results…</Card>
              ) : pastSubjects.length === 0 ? (
                <Card className="py-8 text-center text-muted-foreground">No recorded results for this term.</Card>
              ) : (() => {
                const completed = pastSubjects.filter(s => s.percentage !== null);
                const avg = completed.length > 0
                  ? completed.reduce((acc: number, s: any) => acc + (s.percentage || 0), 0) / completed.length
                  : 0;
                const grade = avg >= pastGradeScheme.gradeAMin ? 'A' : avg >= pastGradeScheme.gradeBMin ? 'B' : avg >= pastGradeScheme.gradeCMin ? 'C' : avg >= pastGradeScheme.gradeDMin ? 'D' : 'F';
                const gradeColorStyle = { color: getGradeColor(grade) };

                return (
                  <Card className="p-4 md:p-6">
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Subjects</p>
                        <p className="text-2xl font-bold">{pastSubjects.length}</p>
                      </div>
                      <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                        <p className="text-2xl font-bold" style={completed.length > 0 ? gradeColorStyle : {}}>{completed.length > 0 ? `${avg.toFixed(0)}%` : "—"}</p>
                      </div>
                      <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground">Grade</p>
                        <p className="text-2xl font-bold" style={completed.length > 0 ? gradeColorStyle : {}}>{completed.length > 0 ? grade : "—"}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {pastSubjects.map((s: any) => {
                        const pct = s.percentage ?? null;
                        const g = s.grade ?? null;
                        const gcStyle = (pct !== null && g) ? { color: getGradeColor(g) } : {};
                        return (
                          <div key={s.subjectName} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                            <span className="font-medium text-sm">{s.subjectName}</span>
                            <div className="flex items-center gap-3 text-sm">
                              {pct !== null ? (
                                <>
                                  <span className="font-bold" style={gcStyle}>{s.totalScore}/100</span>
                                  <span className="font-bold w-6 text-center" style={gcStyle}>{g}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Pending</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === "This Term" && <>
      <h2 className="text-lg md:text-xl font-bold mb-3">Available Exams</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isLoading && <div className="col-span-full text-center py-8">Loading exams...</div>}
        {!isLoading && availableExams.length === 0 && (
          <Card className="col-span-full py-8 text-center text-muted-foreground">
            No active exams available for your class.
          </Card>
        )}
        {availableExams.map(exam => (
          <Card key={exam.id} className="flex flex-col p-4">
            <Badge variant="success" className="w-fit mb-3 text-xs">Active</Badge>
            <h3 className="text-lg md:text-xl font-bold font-display mb-1">{exam.title}</h3>
            <p className="text-primary font-semibold text-xs mb-3">{exam.subject}</p>
            <div className="flex items-center text-xs text-muted-foreground mb-4">
              <Clock className="w-3 h-3 mr-1" /> {exam.durationMinutes} minutes
            </div>
            <Button size="sm" className="w-full" onClick={() => setLocation(`/exam/${exam.id}`)}>
              <PlayCircle className="w-4 h-4 mr-2" /> Start
            </Button>
          </Card>
        ))}
      </div>

      <h2 className="text-lg md:text-xl font-bold mb-3">Your Results</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">You haven't taken any exams yet.</div>
        )}
        {results.map(result => (
          <Card key={result.id} className="flex items-center p-3 md:p-4">
            <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center mr-3 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">{result.examTitle || result.subject}</h3>
              <p className="text-xs text-muted-foreground">{result.subject}</p>
              <p className="text-xs text-muted-foreground">Score: {result.score} / {result.totalQuestions}</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div className="text-xl font-bold text-primary">{result.percentage}%</div>
              <Button variant="outline" size="sm" className="p-1.5" onClick={() => openRetakeModal(result.examId, result.examTitle || result.subject || '')}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Term Results Summary ───────────────────────── */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-bold">Term Report Card</h2>
          <Button variant="outline" size="sm" onClick={() => setLocation("/student/results")}>
            <ClipboardList className="w-4 h-4 mr-1" /> View Full Report
          </Button>
        </div>

        {isLoadingTermResults ? (
          <Card className="py-8 text-center text-muted-foreground">Loading term results…</Card>
        ) : termSubjects.length === 0 ? (
          <Card className="py-8 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="font-semibold">No term results yet</p>
            <p className="text-sm mt-1">Your teachers are still entering scores. Check back later.</p>
          </Card>
        ) : (() => {
          const completed = termSubjects.filter(s => s.percentage !== null);
          const pending = termSubjects.filter(s => s.percentage === null);
          const avg = completed.length > 0
            ? completed.reduce((acc: number, s: any) => acc + (s.percentage || 0), 0) / completed.length
            : 0;
          const grade = avg >= gradeScheme.gradeAMin ? 'A' : avg >= gradeScheme.gradeBMin ? 'B' : avg >= gradeScheme.gradeCMin ? 'C' : avg >= gradeScheme.gradeDMin ? 'D' : 'F';
          const gradeColorStyle = { color: getGradeColor(grade) };

          return (
            <Card className="p-4 md:p-6">
              {/* Summary row */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Subjects</p>
                  <p className="text-2xl font-bold">{termSubjects.length}</p>
                </div>
                <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-secondary">{completed.length}</p>
                </div>
                <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold" style={completed.length > 0 ? gradeColorStyle : {}}>{completed.length > 0 ? `${avg.toFixed(0)}%` : "—"}</p>
                </div>
                <div className="flex-1 min-w-24 bg-muted/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Grade</p>
                  <p className="text-2xl font-bold" style={completed.length > 0 ? gradeColorStyle : {}}>{completed.length > 0 ? grade : "—"}</p>
                </div>
              </div>

              {/* Subject mini-list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {termSubjects.map((s: any) => {
                  const complete = s.midTermScore !== null && s.classActivityScore !== null && s.examScore !== null;
                  const pct = s.percentage ?? null;
                  const g = s.grade ?? null;
                  const gcStyle = (pct !== null && g) ? { color: getGradeColor(g) } : {};
                  return (
                    <div key={s.subjectName} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20">
                      <span className="font-medium text-sm">{s.subjectName}</span>
                      <div className="flex items-center gap-3 text-sm">
                        {complete ? (
                          <>
                            <span className="font-bold" style={gcStyle}>{s.totalScore}/100</span>
                            <span className="font-bold w-6 text-center" style={gcStyle}>{g}</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {pending.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {pending.length} subject{pending.length > 1 ? 's' : ''} still awaiting teacher scores.
                </p>
              )}
            </Card>
          );
        })()}
      </div>

      {/* Retake Modal */}
      <Modal isOpen={retakeModalOpen} onClose={() => setRetakeModalOpen(false)} title={`Retake: ${selectedExam?.title}`}>
        <div className="space-y-3">
          <p className="text-sm">Enter the school's retake passcode.</p>
          <div>
            <label className="block text-sm font-medium mb-1">4-Digit Passcode</label>
            <Input type="password" maxLength={4} placeholder="Enter code" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="text-center text-xl tracking-widest" />
          </div>
          {retakeError && <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">{retakeError}</div>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setRetakeModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleRetakeRequest} isLoading={isRetaking} className="flex-1">Confirm</Button>
          </div>
        </div>
      </Modal>
      </>}
    </DashboardLayout>
  );
}