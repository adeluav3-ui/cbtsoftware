import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetExam, useSubmitExam, Question, type GroupedQuestion } from "@workspace/api-client-react";
import { Card, Button, Modal } from "@/components/ui-elements";
import { Clock, AlertCircle, CheckCircle2, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { ResultDetailModal } from "@/components/result-detail-modal";

export default function TakeExam() {
  const { examId: rawExamId } = useParams();
  const examId = parseInt(rawExamId || "0");
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const [, setLocation] = useLocation();
  const [submittedResultId, setSubmittedResultId] = useState<number | null>(null);
  const [showReview, setShowReview] = useState(false);

  const { data: examData, isLoading } = useGetExam(schoolCode, examId);

  const exam = examData || (() => {
    const cached = localStorage.getItem(`exam_${examId}`);
    return cached ? JSON.parse(cached) : null;
  })();
  const { mutate: submitExam, isPending: isSubmitting } = useSubmitExam();

  const [hasStarted, setHasStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [resultScore, setResultScore] = useState<{ score: number, pct: number } | null>(null);

  // Flatten questions for easy navigation
  const flattenedQuestions = useMemo(() => {
    if (!exam?.questions) return [];
    const flat: any[] = [];
    for (const item of exam.questions) {
      if (item.isGroup) {
        flat.push(...item.questions);
      } else if (item.question) {
        flat.push(item.question);
      }
    }
    return flat;
  }, [exam?.questions]);

  // Get current question/group context
  const getCurrentContext = () => {
    if (!exam?.questions) return { question: null, groupImage: null, isGroupStart: false };

    let flatIndex = 0;
    for (const item of exam.questions) {
      if (item.isGroup) {
        if (currentIdx >= flatIndex && currentIdx < flatIndex + item.questions.length) {
          const questionIndex = currentIdx - flatIndex;
          return {
            question: item.questions[questionIndex],
            groupImage: item.groupImageUrl,
            isGroupStart: questionIndex === 0,
            groupId: item.groupId
          };
        }
        flatIndex += item.questions.length;
      } else if (item.question) {
        if (currentIdx === flatIndex) {
          return { question: item.question, groupImage: null, isGroupStart: false, groupId: null };
        }
        flatIndex++;
      }
    }
    return { question: null, groupImage: null, isGroupStart: false, groupId: null };
  };

  const currentContext = getCurrentContext();
  const q = currentContext.question;

  useEffect(() => {
    if (hasStarted && timeLeft > 0 && !isFinished) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (hasStarted && timeLeft === 0 && !isFinished) {
      handleFinalSubmit();
    }
  }, [hasStarted, timeLeft, isFinished]);

  useEffect(() => {
    if (hasStarted && Object.keys(answers).length > 0) {
      localStorage.setItem(`answers_${examId}`, JSON.stringify(answers));
    }
  }, [answers, examId, hasStarted]);

  useEffect(() => {
    const saved = localStorage.getItem(`answers_${examId}`);
    if (saved) setAnswers(JSON.parse(saved));
  }, [examId]);

  const startExam = async () => {
    if (exam) {
      localStorage.setItem(`exam_${examId}`, JSON.stringify(exam));
      setTimeLeft(exam.durationMinutes * 60);
      setHasStarted(true);
    }
  };

  useEffect(() => {
    if (!hasStarted || isFinished) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasStarted, isFinished]);

  useEffect(() => {
    if (!hasStarted || isFinished) return;

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasStarted, isFinished]);

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
        localStorage.removeItem(`exam_${examId}`);
        localStorage.removeItem(`answers_${examId}`);
        setResultScore({ score: res.score, pct: res.percentage });
        setSubmittedResultId(res.id);
      },
      onError: (err) => {
        console.error("Submit failed:", err);
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
  const isLowTime = timeLeft < 300;

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
                Question {currentIdx + 1} of {flattenedQuestions.length}
              </div>

              {/* Group Image Display */}
              {currentContext.groupImage && currentContext.isGroupStart && (
                <div className="mb-6 p-4 bg-muted/20 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-semibold">Group {currentContext.groupId}</span>
                  </div>
                  <img
                    src={currentContext.groupImage}
                    alt="Group illustration"
                    className="max-w-full max-h-64 object-contain rounded-lg mx-auto"
                  />
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    Answer the following questions based on the image above
                  </p>
                </div>
              )}

              {/* Question Content */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-foreground leading-relaxed">{q.text}</h2>
                {q.imageUrl && !currentContext.groupImage && (
                  <div className="mt-4">
                    <img
                      src={q.imageUrl}
                      alt="Question illustration"
                      className="max-w-full max-h-64 object-contain rounded-lg border border-border mx-auto"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Options */}
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

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-10 pt-6 border-t border-border/50">
                <Button
                  variant="outline"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(p => p - 1)}
                >
                  Previous
                </Button>
                {currentIdx === flattenedQuestions.length - 1 ? (
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

        {/* Sidebar Navigation */}
        <div className="w-full md:w-80 shrink-0">
          <Card className="p-6 sticky top-24">
            <h3 className="font-bold mb-4 font-display">Navigation</h3>
            <div className="grid grid-cols-5 gap-2">
              {flattenedQuestions.map((sq, idx) => {
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
              <h2 className="text-3xl font-bold font-display mb-2">
                {resultScore.score} / {flattenedQuestions.length}
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                You answered {resultScore.score} out of {flattenedQuestions.length} questions correctly
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {exam.assessmentType === 'class_activity'
                  ? "This is a class activity. Your teacher will enter the final score."
                  : "Your CBT score has been recorded. Your teacher will enter the theory score later."}
              </p>
              <div className="flex flex-col gap-3">
                <Button size="lg" variant="outline" onClick={() => setShowReview(true)}>
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
        resultId={showReview ? submittedResultId : null}
        schoolCode={schoolCode}
        onClose={() => setShowReview(false)}
      />
    </div>
  );
}