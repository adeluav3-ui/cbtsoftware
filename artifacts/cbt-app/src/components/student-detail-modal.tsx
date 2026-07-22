import { useQuery } from "@tanstack/react-query";
import { Modal, Badge, Button, Input } from "@/components/ui-elements";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, MinusCircle, Save, Clock, Upload, User, RefreshCw, Eye, EyeOff, Pencil, X } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface StudentDetailModalProps {
  studentId: number | null;
  studentName: string;
  schoolCode: string;
  onClose: () => void;
  onNameUpdated?: (newName: string) => void;
}

interface SubjectScore {
  id: number;
  subjectName: string;
  midTermScore: number | null;
  classActivityScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  percentage: number | null;
  grade: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';

async function fetchStudentDetail(schoolCode: string, studentId: number) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/detail`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch student detail");
  return res.json();
}

async function fetchStudentSubjectScores(schoolCode: string, studentId: number) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch subject scores");
  return res.json();
}

async function saveSubjectScore(schoolCode: string, studentId: number, subjectName: string, component: string, score: number) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/subject-scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectName, component, score }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to save score");
  return res.json();
}

async function resetStudentPassword(schoolCode: string, studentId: number, newPassword: string) {
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword }),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to reset password");
  return res.json();
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function StudentDetailModal({ studentId, studentName, schoolCode, onClose, onNameUpdated }: StudentDetailModalProps) {
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"exams" | "subjects">("exams");
  const [editingScores, setEditingScores] = useState<{ [key: string]: number }>({});
  const [saving, setSaving] = useState<{ subject: string; component: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [displayName, setDisplayName] = useState(studentName);

  const { data, isLoading, refetch: refetchStudent } = useQuery({
    queryKey: ["student-detail", schoolCode, studentId],
    queryFn: () => fetchStudentDetail(schoolCode, studentId!),
    enabled: studentId !== null,
  });

  const { data: subjectScores, isLoading: subjectLoading, refetch: refetchSubjects } = useQuery({
    queryKey: ["student-subject-scores", schoolCode, studentId],
    queryFn: () => fetchStudentSubjectScores(schoolCode, studentId!),
    enabled: studentId !== null,
  });

  const results: any[] = data?.results ?? [];
  const profilePicture = data?.profilePicture || null;
  const studentUsername = data?.username || "";
  const studentPassword = data?.password || "";

  const avgPct = results.length > 0
    ? results.reduce((acc: number, r: any) => acc + (r.percentage ?? 0), 0) / results.length
    : 0;

  const handleSaveScore = async (subjectName: string, component: string, score: number) => {
    if (!studentId) return;
    setSaving({ subject: subjectName, component });
    try {
      await saveSubjectScore(schoolCode, studentId, subjectName, component, score);
      await refetchSubjects();
      setEditingScores(prev => {
        const newState = { ...prev };
        delete newState[`${subjectName}-${component}`];
        return newState;
      });
    } catch (err) {
      console.error("Failed to save", err);
    } finally {
      setSaving(null);
    }
  };

  const handleResetPassword = async () => {
    if (!studentId) return;
    if (!newPassword || newPassword.length < 4) {
      setPasswordMessage("Password must be at least 4 characters");
      return;
    }

    setResettingPassword(true);
    setPasswordMessage("");

    try {
      await resetStudentPassword(schoolCode, studentId, newPassword);
      setPasswordMessage("Password reset successfully!");
      setTimeout(() => setPasswordMessage(""), 3000);
      setNewPassword("");
      setShowPassword(false);
      await refetchStudent();
    } catch (err) {
      setPasswordMessage("Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSaveName = async () => {
    if (!studentId || !nameValue.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: nameValue.trim() }),
        credentials: "include",
      });
      if (res.ok) {
        setDisplayName(nameValue.trim());
        setEditingName(false);
        onNameUpdated?.(nameValue.trim());
      }
    } catch (_) {}
    setSavingName(false);
  };

  const getComponentStatus = (score: number | null) => {
    if (score !== null) {
      return { label: `${score}`, color: "text-success", icon: <CheckCircle className="w-3 h-3" /> };
    }
    return { label: "Pending", color: "text-muted-foreground", icon: <Clock className="w-3 h-3" /> };
  };

  const getGradeColor = (grade?: string | null) => {
    if (!grade) return "bg-muted text-muted-foreground";
    switch (grade) {
      case 'A': return 'bg-green-600 text-white';
      case 'B': return 'bg-blue-600 text-white';
      case 'C': return 'bg-yellow-600 text-white';
      case 'D': return 'bg-orange-600 text-white';
      default: return 'bg-red-600 text-white';
    }
  };

  const calculateOverallAverage = () => {
    if (!subjectScores?.length) return 0;
    const completedSubjects = subjectScores.filter((s: SubjectScore) => s.percentage !== null);
    if (completedSubjects.length === 0) return 0;
    const total = completedSubjects.reduce((acc: number, s: SubjectScore) => acc + (s.percentage || 0), 0);
    return total / completedSubjects.length;
  };

  const overallAvg = calculateOverallAverage();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studentId) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "student-images");

      const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();

      const response = await fetch(
        `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/profile-picture`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePictureUrl: url }),
          credentials: "include",
        }
      );

      if (response.ok) {
        await refetchStudent();
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <Modal isOpen={studentId !== null} onClose={onClose} title={`Student Profile — ${displayName}`} size="lg">
      <div className="space-y-4">
        {/* Profile Picture Upload */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            {profilePicture ? (
              <img src={profilePicture} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-primary/20" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-primary/20">
                <User className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 cursor-pointer bg-primary rounded-full p-1.5 shadow-lg hover:bg-primary/80 transition-colors">
              <Upload className="w-4 h-4 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Student Info Card with Username and Password */}
        <div className="bg-muted/20 p-4 rounded-lg">
          {/* Editable Full Name */}
          <div className="mb-3 pb-3 border-b border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Full Name</p>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  className="text-sm flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName} isLoading={savingName}>
                  <Save className="w-3 h-3 mr-1" /> Save
                </Button>
                <button onClick={() => setEditingName(false)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{displayName}</p>
                <button
                  onClick={() => { setNameValue(displayName); setEditingName(true); }}
                  className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                  title="Edit name"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="font-mono text-sm font-semibold">{studentUsername}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Password</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm">
                  {showPassword ? studentPassword : "••••••"}
                </p>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-muted rounded"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Password Reset Section */}
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Reset Password</p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={handleResetPassword}
                isLoading={resettingPassword}
                variant="outline"
              >
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

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("exams")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "exams"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Exam History
          </button>
          <button
            onClick={() => setActiveTab("subjects")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "subjects"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            Subject Scores
          </button>

          {/* Exam History Tab */}
          {activeTab === "exams" && (
            <>
              {/* Stats */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-27.5 rounded-xl border border-border bg-muted/30 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{results.length}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Exams Taken</p>
                </div>
                <div className="flex-1 min-w-27.5 rounded-xl border border-border bg-muted/30 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">
                    {avgPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Avg CBT Score</p>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
                {results.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">This student hasn't taken any exams yet.</p>
                ) : (
                  results.map((result: any) => {
                    const pct = result.percentage ?? 0;
                    const isExpanded = expandedResult === result.id;
                    return (
                      <div key={result.id} className="rounded-xl border border-border overflow-hidden">
                        {/* Result header */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                          onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                        >
                          <div>
                            <p className="font-bold text-sm">{result.examTitle || "Exam"}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.subject} ·{" "}
                              {result.submittedAt
                                ? format(new Date(result.submittedAt), "MMM d, yyyy h:mm a")
                                : "—"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-base">{result.score}/{result.totalQuestions}</p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {pct.toFixed(1)}%
                              </p>
                            </div>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </button>

                        {/* Answer breakdown */}
                        {isExpanded && (
                          <div className="divide-y divide-border/30">
                            {(result.answers ?? []).length === 0 ? (
                              <p className="px-4 py-3 text-sm text-muted-foreground italic">
                                Detailed answers not available for this submission.
                              </p>
                            ) : (
                              (result.answers ?? []).map((ans: any, idx: number) => {
                                const skipped = ans.selectedOption === null;
                                const isCorrect = ans.isCorrect;
                                return (
                                  <div key={ans.id} className="px-4 py-3 text-sm">
                                    <div className="flex items-start gap-2 mb-2">
                                      {skipped ? (
                                        <MinusCircle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                                      ) : isCorrect ? (
                                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                                      ) : (
                                        <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                                      )}
                                      <p className="font-medium leading-snug">Q{idx + 1}. {ans.questionText}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 ml-6">
                                      {OPTION_LABELS.map(label => {
                                        const value = ans[`option${label}`];
                                        const isStudentPick = ans.selectedOption === label;
                                        const isCorrectOption = ans.correctOption === label;
                                        return (
                                          <div
                                            key={label}
                                            className={`text-xs rounded-lg px-2.5 py-1.5 border ${isCorrectOption && isStudentPick
                                              ? "bg-green-100 border-green-400 font-bold"
                                              : isCorrectOption
                                                ? "bg-green-50 border-green-300 font-semibold text-green-800"
                                                : isStudentPick
                                                  ? "bg-red-100 border-red-400 font-bold text-red-800"
                                                  : "bg-muted/30 border-border/40 text-muted-foreground"
                                              }`}
                                          >
                                            <span className="font-mono">{label}.</span> {value}
                                            {isCorrectOption && !isStudentPick && (
                                              <span className="text-green-700"> ✓</span>
                                            )}
                                            {isStudentPick && !isCorrectOption && (
                                              <span className="text-red-700"> ✗</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {skipped && (
                                      <p className="text-xs text-yellow-700 ml-6 mt-1">Not answered</p>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* Subject Scores Tab */}
          {activeTab === "subjects" && (
            <div className="space-y-4">
              {/* Overall Average */}
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Overall Academic Performance</p>
                <p className={`text-3xl font-bold ${overallAvg >= 70 ? "text-green-600" : "text-destructive"}`}>
                  {overallAvg.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {subjectScores?.filter((s: SubjectScore) => s.percentage !== null).length || 0} completed subjects
                </p>
              </div>

              {subjectLoading ? (
                <div className="text-center py-8">Loading subject scores...</div>
              ) : !subjectScores?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subject records found. Teachers need to create exams first.
                </div>
              ) : (
                <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
                  {subjectScores.map((subject: SubjectScore) => {
                    const allEntered = subject.midTermScore !== null && subject.classActivityScore !== null && subject.examScore !== null;

                    return (
                      <div key={subject.subjectName} className="border border-border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-bold font-display">{subject.subjectName}</h3>
                          {allEntered ? (
                            <div className="text-right">
                              <div className="text-xl font-bold text-primary">{subject.percentage}%</div>
                              <Badge className={getGradeColor(subject.grade)}>{subject.grade}</Badge>
                            </div>
                          ) : (
                            <Badge variant="outline">Incomplete</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Mid-Term */}
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold">Mid-Term (20%)</span>
                              <span className="flex items-center gap-1 text-xs">
                                {getComponentStatus(subject.midTermScore).icon}
                                <span className={getComponentStatus(subject.midTermScore).color}>
                                  {getComponentStatus(subject.midTermScore).label}
                                </span>
                              </span>
                            </div>
                            {subject.midTermScore !== null ? (
                              <div className="text-center py-1">
                                <span className="text-lg font-bold">{subject.midTermScore}/20</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={20}
                                  placeholder="Score"
                                  value={editingScores[`${subject.subjectName}-midterm`] || ""}
                                  onChange={(e) => setEditingScores(prev => ({
                                    ...prev,
                                    [`${subject.subjectName}-midterm`]: parseInt(e.target.value) || 0
                                  }))}
                                  className="flex-1 text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveScore(
                                    subject.subjectName,
                                    "midterm",
                                    editingScores[`${subject.subjectName}-midterm`] || 0
                                  )}
                                  isLoading={saving?.subject === subject.subjectName && saving?.component === "midterm"}
                                  disabled={!editingScores[`${subject.subjectName}-midterm`]}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Class Activity */}
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold">Class Activity (20%)</span>
                              <span className="flex items-center gap-1 text-xs">
                                {getComponentStatus(subject.classActivityScore).icon}
                                <span className={getComponentStatus(subject.classActivityScore).color}>
                                  {getComponentStatus(subject.classActivityScore).label}
                                </span>
                              </span>
                            </div>
                            {subject.classActivityScore !== null ? (
                              <div className="text-center py-1">
                                <span className="text-lg font-bold">{subject.classActivityScore}/20</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={20}
                                  placeholder="Score"
                                  value={editingScores[`${subject.subjectName}-activity`] || ""}
                                  onChange={(e) => setEditingScores(prev => ({
                                    ...prev,
                                    [`${subject.subjectName}-activity`]: parseInt(e.target.value) || 0
                                  }))}
                                  className="flex-1 text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveScore(
                                    subject.subjectName,
                                    "activity",
                                    editingScores[`${subject.subjectName}-activity`] || 0
                                  )}
                                  isLoading={saving?.subject === subject.subjectName && saving?.component === "activity"}
                                  disabled={!editingScores[`${subject.subjectName}-activity`]}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Exam */}
                          <div className="bg-muted/20 p-3 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold">Exam (60%)</span>
                              <span className="flex items-center gap-1 text-xs">
                                {getComponentStatus(subject.examScore).icon}
                                <span className={getComponentStatus(subject.examScore).color}>
                                  {getComponentStatus(subject.examScore).label}
                                </span>
                              </span>
                            </div>
                            {subject.examScore !== null ? (
                              <div className="text-center py-1">
                                <span className="text-lg font-bold">{subject.examScore}/60</span>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  max={60}
                                  placeholder="Score"
                                  value={editingScores[`${subject.subjectName}-exam`] || ""}
                                  onChange={(e) => setEditingScores(prev => ({
                                    ...prev,
                                    [`${subject.subjectName}-exam`]: parseInt(e.target.value) || 0
                                  }))}
                                  className="flex-1 text-sm"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveScore(
                                    subject.subjectName,
                                    "exam",
                                    editingScores[`${subject.subjectName}-exam`] || 0
                                  )}
                                  isLoading={saving?.subject === subject.subjectName && saving?.component === "exam"}
                                  disabled={!editingScores[`${subject.subjectName}-exam`]}
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {allEntered && (
                          <div className="mt-3 pt-3 border-t border-border/50 text-right">
                            <span className="text-sm text-muted-foreground">
                              Total: {subject.totalScore}/100 | {subject.percentage}% | Grade: {subject.grade}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}