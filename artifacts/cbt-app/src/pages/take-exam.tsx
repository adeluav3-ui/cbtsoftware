import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetExam, useSubmitExam, Question } from "@workspace/api-client-react";
import { Card, Button, Modal } from "@/components/ui-elements";
import { Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { ResultDetailModal } from "@/components/result-detail-modal";

export default function TakeExam() {
  const { examId: rawExamId } = useParams();
  const examId = parseInt(rawExamId || "0");
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [, setLocation] = useLocation();
  const [submittedResultId, setSubmittedResultId] = useState<number | null>(null);

  const { data: exam, isLoading } = useGetExam(schoolCode, examId);
  const { mutate: submitExam, isPending: isSubmitting } = useSubmitExam();

  const [hasStarted, setHasStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [resultScore, setResultScore] = useState<{ score: number, pct: number } | null>(null);

  const shuffledQuestions = useMemo(() => {
    if (!exam?.questions) return [];
    return [...exam.questions].sort(() => Math.random() - 0.5);
  }, [exam?.questions]);

  useEffect(() => {
    if (hasStarted && timeLeft > 0 && !isFinished) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (hasStarted && timeLeft === 0 && !isFinished) {
      handleFinalSubmit();
    }
  }, [hasStarted, timeLeft, isFinished]);

  const startExam = () => {
    if (exam) {
      setTimeLeft(exam.durationMinutes * 60);
      setHasStarted(true);
    }
  };

  const handleFinalSubmit = () => {
    if (isFinished || !user) return;
    setIsFinished(true);
    submitExam({
      schoolCode,
      examId,
      data: {
        studentId: user.id,
        fullName: user.fullName || user.username,
        answers
      }
    }, {
      onSuccess: (res) => {
        setResultScore({ score: res.score, pct: res.percentage });
        setSubmittedResultId(res.id); // ← store result ID
      },
      onError: (err) => {
        console.error("Submit failed:", err);
        // Reset so student can retry
        setIsFinished(false);
      }
    });
  };

  if (isLoading || !exam) return <div className="h-screen flex items-center justify-center">Loading exam...</div>;

  if (!hasStarted) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center border-t-8 border-t-primary">
          <AlertCircle className="w-16 h-16 text-primary mx-auto mb-6 opacity-80" />
          <h1 className="text-3xl font-display font-bold mb-2">{exam.title}</h1>
          <p className="text-muted-foreground mb-6">Subject: {exam.subject} • Duration: {exam.durationMinutes} Mins</p>
          <div className="bg-destructive/10 text-destructive p-4 rounded-xl text-sm font-semibold mb-8 text-left">
            Instructions:
            <ul className="list-disc pl-5 mt-2 font-normal space-y-1">
              <li>Do not refresh the page once started.</li>
              <li>Timer cannot be paused.</li>
              <li>Exam auto-submits when time reaches 0:00.</li>
            </ul>
          </div>
          <Button size="lg" className="w-full text-lg" onClick={startExam}>Begin Exam Now</Button>
          <Button variant="ghost" className="w-full mt-2" onClick={() => setLocation("/student")}>Cancel</Button>
        </Card>
      </div>
    );
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const isLowTime = timeLeft < 300; // less than 5 mins

  const q = shuffledQuestions[currentIdx];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 shadow-sm sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold font-display">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">{user?.fullName}</p>
        </div>
        <div className={`flex items-center font-mono text-2xl font-bold ${isLowTime ? 'text-destructive animate-pulse' : 'text-primary'}`}>
          <Clock className="w-6 h-6 mr-2" />
          {timeStr}
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 flex flex-col md:flex-row gap-8">

        {/* Question Area */}
        <div className="flex-1">
          {q ? (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-3xl p-8 shadow-xl border border-border/50"
            >
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-6">
                Question {currentIdx + 1} of {shuffledQuestions.length}
              </div>
              <h2 className="text-2xl font-semibold mb-8 text-foreground leading-relaxed">{q.text}</h2>

              <div className="space-y-4">
                {['A', 'B', 'C', 'D'].map(optKey => {
                  const val = q[`option${optKey}` as keyof Question];
                  const isSelected = answers[q.id.toString()] === optKey;
                  return (
                    <button
                      key={optKey}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: optKey }))}
                      className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center ${isSelected
                        ? 'border-primary bg-primary/10 ring-4 ring-primary/20'
                        : 'border-border bg-background hover:border-primary/40'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 shrink-0 transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                        {optKey}
                      </div>
                      <span className="text-lg">{val as string}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between mt-10 pt-6 border-t border-border/50">
                <Button
                  variant="outline"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(p => p - 1)}
                >
                  Previous
                </Button>
                {currentIdx === shuffledQuestions.length - 1 ? (
                  <Button variant="primary" onClick={handleFinalSubmit}>Submit Exam</Button>
                ) : (
                  <Button onClick={() => setCurrentIdx(p => p + 1)}>Next Question</Button>
                )}
              </div>
            </motion.div>
          ) : (
            <div>No questions available.</div>
          )}
        </div>

        {/* Sidebar Nav */}
        <div className="w-full md:w-80 shrink-0">
          <Card className="p-6 sticky top-24">
            <h3 className="font-bold mb-4 font-display">Navigation</h3>
            <div className="grid grid-cols-5 gap-2">
              {shuffledQuestions.map((sq, idx) => {
                const isAns = !!answers[sq.id.toString()];
                const isCurr = idx === currentIdx;
                return (
                  <button
                    key={sq.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${isCurr ? 'ring-4 ring-primary bg-primary text-white' :
                      isAns ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-8 pt-6 border-t border-border flex flex-col gap-3">
              <Button variant="destructive" className="w-full" onClick={() => {
                if (confirm("Are you sure you want to submit? You cannot undo this.")) {
                  handleFinalSubmit();
                }
              }}>
                Submit Exam Now
              </Button>
            </div>
          </Card>
        </div>
      </main>

      <Modal isOpen={isFinished} onClose={() => { }} title="Exam Completed">
        <div className="text-center py-8">
          {isSubmitting ? (
            <div className="text-xl font-semibold animate-pulse">Calculating Results...</div>
          ) : resultScore ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="w-24 h-24 text-success mx-auto mb-6" />
              <h2 className="text-4xl font-bold font-display mb-2">{resultScore.pct.toFixed(1)}%</h2>
              <p className="text-xl text-muted-foreground mb-8">
                You scored {resultScore.score} out of {shuffledQuestions.length}
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setSubmittedResultId(submittedResultId)}
                >
                  Review My Answers
                </Button>
                <Button size="lg" onClick={() => setLocation("/student")}>
                  Return to Dashboard
                </Button>
              </div>
            </motion.div>
          ) : (
            <div>Processing...</div>
          )}
        </div>
      </Modal>
      <ResultDetailModal
        resultId={submittedResultId}
        schoolCode={schoolCode}
        onClose={() => setSubmittedResultId(null)}
      />
    </div>
  );
}
