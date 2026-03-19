import { useQuery } from "@tanstack/react-query";
import { Modal, Badge } from "@/components/ui-elements";
import { ChevronDown, ChevronRight, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface StudentDetailModalProps {
  studentId: number | null;
  studentName: string;
  schoolCode: string;
  onClose: () => void;
}

async function fetchStudentDetail(schoolCode: string, studentId: number) {
  const res = await fetch(`/api/schools/${schoolCode}/students/${studentId}/detail`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch student detail");
  return res.json();
}

const OPTION_LABELS = ["A", "B", "C", "D"];

export function StudentDetailModal({ studentId, studentName, schoolCode, onClose }: StudentDetailModalProps) {
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail", schoolCode, studentId],
    queryFn: () => fetchStudentDetail(schoolCode, studentId!),
    enabled: studentId !== null,
  });

  const results: any[] = data?.results ?? [];
  const avgPct = results.length > 0
    ? results.reduce((acc: number, r: any) => acc + (r.percentage ?? 0), 0) / results.length
    : 0;

  return (
    <Modal isOpen={studentId !== null} onClose={onClose} title={`Student Profile — ${studentName}`} size="lg">
      {isLoading || !data ? (
        <div className="py-12 text-center text-muted-foreground">Loading student profile…</div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[110px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-bold text-primary">{results.length}</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Exams Taken</p>
            </div>
            <div className="flex-1 min-w-[110px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className={`text-3xl font-bold ${avgPct >= 70 ? "text-green-600" : "text-destructive"}`}>
                {avgPct.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Avg Score</p>
            </div>
            <div className="flex-1 min-w-[110px] rounded-xl border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-bold text-green-600">
                {results.filter((r: any) => (r.percentage ?? 0) >= 70).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">Passes</p>
            </div>
            <div className="flex-1 min-w-[110px] rounded-xl border border-border bg-muted/30 p-4 text-center">
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
                      <div className="flex items-center gap-3 flex-shrink-0">
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
                                    <MinusCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                                  ) : isCorrect ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
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
                                        className={`text-xs rounded-lg px-2.5 py-1.5 border ${
                                          isCorrectOption && isStudentPick
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
        </div>
      )}
    </Modal>
  );
}
