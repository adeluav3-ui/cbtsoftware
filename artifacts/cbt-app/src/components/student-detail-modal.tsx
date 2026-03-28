import { useQuery } from "@tanstack/react-query";
import { Modal, Badge, Button, Input } from "@/components/ui-elements";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, MinusCircle, Save, Clock, Upload, User } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

interface StudentDetailModalProps {
  studentId: number | null;
  studentName: string;
  schoolCode: string;
  onClose: () => void;
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

const OPTION_LABELS = ["A", "B", "C", "D"];

export function StudentDetailModal({ studentId, studentName, schoolCode, onClose }: StudentDetailModalProps) {
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"exams" | "subjects">("exams");
  const [editingScores, setEditingScores] = useState<{ [key: string]: number }>({});
  const [saving, setSaving] = useState<{ subject: string; component: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `student-profiles/${fileName}`;

      const { data, error } = await supabase.storage
        .from('student-images')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('student-images')
        .getPublicUrl(filePath);

      const response = await fetch(
        `${API_BASE_URL}/schools/${schoolCode}/students/${studentId}/profile-picture`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilePictureUrl: publicUrl }),
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
    <Modal isOpen={studentId !== null} onClose={onClose} title={`Student Profile — ${studentName}`} size="lg">
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
        </div>

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
                <p className={`text-3xl font-bold ${avgPct >= 70 ? "text-green-600" : "text-destructive"}`}>
                  {avgPct.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Avg Score</p>
              </div>
              <div className="flex-1 min-w-27.5 rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="text-3xl font-bold text-green-600">
                  {results.filter((r: any) => (r.percentage ?? 0) >= 70).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Passes</p>
              </div>
              <div className="flex-1 min-w-27.5 rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="text-3xl font-bold text-destructive">
                  {results.filter((r: any) => (r.percentage ?? 0) < 70).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Fails</p>
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
                            <p className={`text-xs font-semibold ${pct >= 70 ? "text-green-600" : "text-destructive"}`}>
                              {pct.toFixed(1)}%
                            </p>
                          </div>
                          <Badge variant={pct >= 70 ? "success" : "destructive"}>
                            {pct >= 70 ? "Pass" : "Fail"}
                          </Badge>
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
    </Modal>
  );
}