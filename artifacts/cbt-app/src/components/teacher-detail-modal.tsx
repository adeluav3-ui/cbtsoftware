import { useQuery } from "@tanstack/react-query";
import { Modal, Badge, Button, Input } from "@/components/ui-elements";
import { BookOpen, Users, ChevronDown, ChevronRight, Key, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface TeacherDetailModalProps {
  teacherId: number | null;
  teacherName: string;
  schoolCode: string;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

async function fetchTeacherDetail(schoolCode: string, teacherId: number) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}/detail`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch teacher detail");
  return res.json();
}

async function fetchTeacherCredentials(schoolCode: string, teacherId: number) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/credentials`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch credentials");
  const all = await res.json();
  return all.find((t: any) => t.id === teacherId) ?? null;
}

export function TeacherDetailModal({ teacherId, teacherName, schoolCode, onClose }: TeacherDetailModalProps) {
  const [expandedExam, setExpandedExam] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<"exams" | "students" | "credentials">("exams");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-detail", schoolCode, teacherId],
    queryFn: () => fetchTeacherDetail(schoolCode, teacherId!),
    enabled: teacherId !== null,
  });

  const { data: creds, refetch: refetchCreds } = useQuery({
    queryKey: ["teacher-credentials-single", schoolCode, teacherId],
    queryFn: () => fetchTeacherCredentials(schoolCode, teacherId!),
    enabled: teacherId !== null,
  });

  const allResults: any[] = (data?.exams ?? []).flatMap((e: any) =>
    (e.results ?? []).map((r: any) => ({ ...r, examTitle: e.title, subject: e.subject }))
  );

  const handleResetPassword = async () => {
    if (!teacherId) return;
    if (!newPassword || newPassword.length < 4) {
      setPasswordMessage("Password must be at least 4 characters");
      return;
    }
    setResettingPassword(true);
    setPasswordMessage("");
    try {
      const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/teachers/${teacherId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      });
      if (res.ok) {
        setPasswordMessage("Password reset successfully!");
        setNewPassword("");
        setShowPassword(false);
        await refetchCreds();
        setTimeout(() => setPasswordMessage(""), 3000);
      } else {
        setPasswordMessage("Failed to reset password");
      }
    } catch (_) {
      setPasswordMessage("Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <Modal isOpen={teacherId !== null} onClose={onClose} title={`Teacher Profile — ${teacherName}`} size="xl">
      {isLoading || !data ? (
        <div className="py-12 text-center text-muted-foreground">Loading teacher profile…</div>
      ) : (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{data.exams?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Exams Set</p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-bold text-primary">
                {(data.exams ?? []).reduce((acc: number, e: any) => acc + (e.questions?.length ?? 0), 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Total Questions</p>
            </div>
            <div className="flex-1 min-w-[120px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{allResults.length}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Submissions</p>
            </div>
          </div>

          {/* Section toggle */}
          <div className="flex gap-2 border-b border-border pb-2 flex-wrap">
            <button
              onClick={() => setActiveSection("exams")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeSection === "exams" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <BookOpen className="w-4 h-4 inline mr-1.5" />Exams & Questions
            </button>
            <button
              onClick={() => setActiveSection("students")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeSection === "students" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Users className="w-4 h-4 inline mr-1.5" />Student Results
            </button>
            <button
              onClick={() => setActiveSection("credentials")}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeSection === "credentials" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Key className="w-4 h-4 inline mr-1.5" />Credentials
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
            {activeSection === "exams" && (
              <>
                {(data.exams ?? []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No exams created yet.</p>
                ) : (
                  (data.exams ?? []).map((exam: any) => (
                    <div key={exam.id} className="rounded-xl border border-border overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                        onClick={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="font-bold text-sm">{exam.title}</p>
                            <p className="text-xs text-muted-foreground">{exam.subject} · {exam.class} · {exam.questions?.length ?? 0} questions · {exam.results?.length ?? 0} submissions</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={exam.isActive ? "success" : "default"}>
                            {exam.isActive ? "Live" : "Draft"}
                          </Badge>
                          {expandedExam === exam.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </div>
                      </button>
                      {expandedExam === exam.id && (
                        <div className="divide-y divide-border/40">
                          {(exam.questions ?? []).length === 0 ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">No questions added.</p>
                          ) : (
                            (exam.questions ?? []).map((q: any, idx: number) => (
                              <div key={q.id} className="px-4 py-3 text-sm">
                                <p className="font-medium mb-1">Q{idx + 1}. {q.text}</p>
                                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                                  {["A", "B", "C", "D"].map(l => (
                                    <span key={l} className={`rounded px-2 py-0.5 ${q.correctOption === l ? "bg-green-100 text-green-800 font-semibold" : "bg-muted/50"}`}>
                                      {l}. {q[`option${l}`]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}

            {activeSection === "students" && (
              <>
                {allResults.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No student submissions yet.</p>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                        <th className="px-3 py-2 font-semibold">Student</th>
                        <th className="px-3 py-2 font-semibold">Class</th>
                        <th className="px-3 py-2 font-semibold">Exam</th>
                        <th className="px-3 py-2 font-semibold text-center">Score</th>
                        <th className="px-3 py-2 font-semibold text-center">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allResults.map((r: any) => {
                        const pct = r.percentage ?? 0;
                        return (
                          <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                            <td className="px-3 py-2.5 font-semibold">{r.fullName}</td>
                            <td className="px-3 py-2.5"><Badge>{r.class}</Badge></td>
                            <td className="px-3 py-2.5 text-muted-foreground">{r.examTitle}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{r.score}/{r.totalQuestions}</td>
                            <td className="px-3 py-2.5 text-center font-semibold">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {activeSection === "credentials" && (
              <div className="space-y-4">
                <div className="bg-muted/20 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="font-mono text-sm font-semibold">{creds?.username ?? teacherName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Password</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">
                          {creds?.generatedPassword
                            ? (showPassword ? creds.generatedPassword : "••••••")
                            : <span className="italic text-muted-foreground text-xs">Reset to reveal</span>}
                        </p>
                        {creds?.generatedPassword && (
                          <button onClick={() => setShowPassword(!showPassword)} className="p-1 hover:bg-muted rounded">
                            {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Reset Password</p>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="New password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="text-sm flex-1"
                      />
                      <Button size="sm" onClick={handleResetPassword} isLoading={resettingPassword} variant="outline">
                        <RefreshCw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                    </div>
                    {passwordMessage && (
                      <p className={`text-xs mt-1 ${passwordMessage.includes("success") ? "text-green-600" : "text-red-600"}`}>
                        {passwordMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
