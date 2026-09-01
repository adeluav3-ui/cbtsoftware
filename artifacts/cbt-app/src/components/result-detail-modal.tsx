import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui-elements";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";

interface ResultDetailModalProps {
  resultId: number | null;
  schoolCode: string;
  onClose: () => void;
}

async function fetchResultDetail(schoolCode: string, resultId: number) {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cbtsoftware.onrender.com/api';
  const res = await fetch(`${API_BASE_URL}/schools/${schoolCode}/results/${resultId}/detail`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch result detail");
  return res.json();
}

const OPTION_LABELS = ["A", "B", "C", "D"];
const OPTION_KEYS = ["optionA", "optionB", "optionC", "optionD"] as const;

export function ResultDetailModal({ resultId, schoolCode, onClose }: ResultDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["result-detail", schoolCode, resultId],
    queryFn: () => fetchResultDetail(schoolCode, resultId!),
    enabled: resultId !== null,
  });

  const pct = data?.percentage ?? 0;

  return (
    <Modal
      isOpen={resultId !== null}
      onClose={onClose}
      title={`Result Detail — ${data?.fullName ?? "..."}`}
      size="lg"
    >
      {isLoading || !data ? (
        <div className="py-12 text-center text-muted-foreground">Loading details…</div>
      ) : (
        <div className="space-y-5">
          {/* Summary card */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Exam</p>
              <p className="font-bold text-base">{data.examTitle}</p>
              <p className="text-sm text-muted-foreground">{data.subject}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Score</p>
              <p className="font-bold text-2xl text-primary">{data.score}/{data.totalQuestions}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Percentage</p>
              <p className="font-bold text-2xl text-primary">{pct.toFixed(1)}%</p>
            </div>
            {data.grade && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Grade</p>
                <p className={`font-bold text-3xl ${
                  data.grade === "A" ? "text-green-600" :
                  data.grade === "B" ? "text-blue-600" :
                  data.grade === "C" ? "text-yellow-600" :
                  data.grade === "D" ? "text-orange-600" :
                  "text-destructive"
                }`}>{data.grade}</p>
              </div>
            )}
          </div>

          {/* Answer breakdown */}
          <div>
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
              Question Breakdown ({data.answers?.length ?? 0} questions)
            </h3>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {(data.answers ?? []).map((ans: any, i: number) => {
                const isCorrect = ans.isCorrect;
                const skipped = ans.selectedOption === null;
                return (
                  <div
                    key={ans.id}
                    className={`rounded-xl border p-4 ${skipped
                        ? "border-yellow-300 bg-yellow-50/40"
                        : isCorrect
                          ? "border-green-300 bg-green-50/40"
                          : "border-red-300 bg-red-50/40"
                      }`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      {skipped ? (
                        <MinusCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      ) : isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                      )}
                      <p className="font-semibold text-sm leading-snug">
                        Q{i + 1}. {ans.questionText}
                      </p>
                    </div>
                    {ans.correctOption?.startsWith("[") ? (
                      // Subjective question
                      <div className="space-y-2">
                        <div className={`text-sm rounded-lg px-3 py-2 border ${isCorrect ? "bg-green-100 border-green-400" : skipped ? "bg-yellow-50 border-yellow-300" : "bg-red-100 border-red-400"}`}>
                          <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Student answered: </span>
                          {skipped ? <span className="italic text-muted-foreground">No answer</span> : <span className="font-medium">{ans.selectedOption}</span>}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold mb-1">Accepted answers:</p>
                          <div className="flex flex-wrap gap-1">
                            {(() => { try { return JSON.parse(ans.correctOption); } catch { return []; } })().map((a: string, ai: number) => (
                              <span key={ai} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300 font-medium">{a}</span>
                            ))}
                          </div>
                        </div>
                        {skipped && <p className="text-xs text-yellow-700 mt-1 font-medium">Student did not answer this question.</p>}
                      </div>
                    ) : (
                      // Objective question
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {OPTION_KEYS.map((_key, idx) => {
                            const label = OPTION_LABELS[idx];
                            const optionKey = `option${label}`;
                            const value = ans[optionKey];
                            const isStudentPick = ans.selectedOption === label;
                            const isCorrectOption = ans.correctOption === label;
                            return (
                              <div
                                key={label}
                                className={`text-sm rounded-lg px-3 py-2 border transition-all ${isCorrectOption && isStudentPick
                                    ? "bg-green-100 border-green-400 font-bold"
                                    : isCorrectOption
                                      ? "bg-green-50 border-green-300 font-semibold text-green-800"
                                      : isStudentPick
                                        ? "bg-red-100 border-red-400 font-bold text-red-800"
                                        : "bg-background border-border/40"
                                  }`}
                              >
                                <span className="font-mono mr-1">{label}.</span> {value}
                                {isCorrectOption && (
                                  <span className="ml-1 text-green-700 text-xs font-semibold"> ✓ Correct</span>
                                )}
                                {isStudentPick && !isCorrectOption && (
                                  <span className="ml-1 text-red-700 text-xs font-semibold"> ✗ Picked</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {skipped && (
                          <p className="text-xs text-yellow-700 mt-2 font-medium">
                            Student did not answer this question.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
