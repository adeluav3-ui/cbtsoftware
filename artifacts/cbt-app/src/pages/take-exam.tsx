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

  // Shuffle groups and individual questions while preserving group order
  const shuffledExamItems = useMemo(() => {
    if (!exam?.questions) return [];

    const groups: any[] = [];
    const individuals: any[] = [];

    for (const item of exam.questions) {
      if (item.isGroup) {
        groups.push(item);
      } else if (item.question) {
        individuals.push(item);
      }
    }

    for (let i = groups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }

    for (let i = individuals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [individuals[i], individuals[j]] = [individuals[j], individuals[i]];
    }

    const allItems = [...groups, ...individuals];
    for (let i = allItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    return allItems;
  }, [exam?.questions]);

  // Flatten questions for easy navigation
  const flattenedQuestions = useMemo(() => {
    const flat: any[] = [];
    for (const item of shuffledExamItems) {
      if (item.isGroup && item.questions) {
        flat.push(...item.questions);
      } else if (item.question) {
        flat.push(item.question);
      }
    }
    return flat;
  }, [shuffledExamItems]);

  // Get current question/group context
  const getCurrentContext = () => {
    if (!shuffledExamItems.length) return { question: null, groupImage: null, isGroupStart: false, groupId: null };

    let flatIndex = 0;
    for (const item of shuffledExamItems) {
      if (item.isGroup && item.questions) {
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

  if (isLoading || !exam) return <div className="h-screen flex items-center justify-center text-sm">Loading exam...</div>;

  if (!hasStarted) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4 opacity-80" />
          <h1 className="text-2xl font-display font-bold mb-2">{exam.title}</h1>
          <p className="text-muted-foreground text-sm mb-4">Subject: {exam.subject} • Duration: {exam.durationMinutes} mins</p>
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-xs text-left mb-6">
            <p className="font-semibold">Instructions:</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>Do not refresh the page once started.</li>
              <li>Timer cannot be paused.</li>
              <li>Auto-submits when time reaches 0:00.</li>
            </ul>
          </div>
          <Button size="default" className="w-full" onClick={startExam}>Begin Exam</Button>
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
      <header className="bg-card border-b border-border p-3 shadow-sm sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold font-display truncate max-w-37.5">{exam.title}</h1>
          <p className="text-xs text-muted-foreground">{user?.fullName?.split(' ')[0]}</p>
        </div>
        <div className={`flex items-center font-mono text-xl font-bold ${isLowTime ? 'text-destructive animate-pulse' : 'text-primary'}`}>
          <Clock className="w-5 h-5 mr-1" />
          {timeStr}
        </div>
      </header>

      <main className="flex-1 w-full p-3 md:p-8 flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Question Area */}
        <div className="flex-1">
          {q ? (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-xl md:rounded-3xl p-4 md:p-8 shadow-xl border border-border/50"
            >
              <div className="text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Question {currentIdx + 1} of {flattenedQuestions.length}
              </div>

              {/* Group Image Display */}
              {currentContext.groupImage && currentContext.isGroupStart && (
                <div className="mb-4 p-3 bg-muted/20 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Layers className="w-3 h-3" />
                    <span className="text-xs font-semibold">Group {currentContext.groupId}</span>
                  </div>
                  <img src={currentContext.groupImage} alt="Group illustration" className="max-w-full max-h-48 object-contain rounded-lg mx-auto" />
                  <p className="text-center text-xs text-muted-foreground mt-2">Answer based on the image above</p>
                </div>
              )}

              {/* Question Content */}
              <div className="mb-6">
                <h2 className="text-base md:text-2xl font-semibold">{q.text}</h2>
                {q.imageUrl && !currentContext.groupImage && (
                  <div className="mt-3">
                    <img src={q.imageUrl} alt="Question illustration" className="max-w-full max-h-48 object-contain rounded-lg border border-border mx-auto" loading="lazy" />
                  </div>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2 md:space-y-3">
                {['A', 'B', 'C', 'D'].map(optKey => {
                  const val = q[`option${optKey}` as keyof Question];
                  const isSelected = answers[q.id.toString()] === optKey;
                  return (
                    <button
                      key={optKey}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: optKey }))}
                      className={`w-full text-left p-3 md:p-4 rounded-xl border-2 transition-all flex items-center gap-2 md:gap-3 ${isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border bg-background hover:border-primary/40'
                        }`}
                    >
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-sm md:text-base shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-muted'
                        }`}>
                        {optKey}
                      </div>
                      <span className="text-sm md:text-lg">{val as string}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between gap-3 mt-6 md:mt-10 pt-4 md:pt-6 border-t">
                <Button variant="outline" size="sm" disabled={currentIdx === 0} onClick={() => setCurrentIdx(p => p - 1)}>
                  Previous
                </Button>
                {currentIdx === flattenedQuestions.length - 1 ? (
                  <Button variant="primary" size="sm" onClick={handleFinalSubmit}>Submit</Button>
                ) : (
                  <Button size="sm" onClick={() => setCurrentIdx(p => p + 1)}>Next</Button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-8">No questions available.</div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="w-full md:w-72 shrink-0">
          <Card className="p-3 md:p-4 sticky top-20">
            <h3 className="font-bold text-sm mb-3">Navigation</h3>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {flattenedQuestions.map((sq, idx) => {
                const isAns = !!answers[sq.id.toString()];
                const isCurr = idx === currentIdx;
                return (
                  <button
                    key={sq.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-xl font-bold text-xs md:text-sm transition-all ${isCurr ? 'bg-primary text-white ring-2 ring-primary ring-offset-2' :
                        isAns ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t">
              <Button variant="destructive" size="sm" className="w-full" onClick={() => {
                if (confirm("Are you sure you want to submit?")) handleFinalSubmit();
              }}>
                Submit Exam
              </Button>
            </div>
          </Card>
        </div>
      </main>

      <Modal isOpen={isFinished} onClose={() => { }} title="Exam Completed">
        <div className="text-center py-6">
          {isSubmitting ? (
            <div className="text-base animate-pulse">Calculating Results...</div>
          ) : resultScore ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
              <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
              <h2 className="text-2xl font-bold">{resultScore.score} / {flattenedQuestions.length}</h2>
              <p className="text-sm text-muted-foreground mb-4">You answered {resultScore.score} out of {flattenedQuestions.length} correctly</p>
              <div className="flex flex-col gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowReview(true)}>Review Answers</Button>
                <Button size="sm" onClick={() => setLocation("/student")}>Return to Dashboard</Button>
              </div>
            </motion.div>
          ) : (
            <div>Processing...</div>
          )}
        </div>
      </Modal>

      <ResultDetailModal resultId={showReview ? submittedResultId : null} schoolCode={schoolCode} onClose={() => setShowReview(false)} />
    </div>
  );
}