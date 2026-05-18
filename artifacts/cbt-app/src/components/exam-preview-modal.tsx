import { useState, useMemo, useEffect } from "react";
import { type GroupedQuestion, type Question } from "@workspace/api-client-react";
import { Button } from "@/components/ui-elements";
import { Clock, Layers, X, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface ExamForPreview {
  title: string;
  subject: string;
  durationMinutes: number;
  questions: GroupedQuestion[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  exam: ExamForPreview;
}

export function ExamPreviewModal({ isOpen, onClose, exam }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentIdx(0);
  }, [isOpen]);

  const orderedExamItems = useMemo<GroupedQuestion[]>(
    () => exam.questions ?? [],
    [exam.questions]
  );

  const flattenedQuestions = useMemo(() => {
    const flat: Question[] = [];
    for (const item of orderedExamItems) {
      if (item.isGroup && item.questions) {
        flat.push(...item.questions);
      } else if (item.question) {
        flat.push(item.question);
      }
    }
    return flat;
  }, [orderedExamItems]);

  const getCurrentContext = () => {
    if (!orderedExamItems.length) {
      return { question: null, groupTitle: null, groupText: null, groupImage: null, groupId: null };
    }
    let flatIndex = 0;
    for (const item of orderedExamItems) {
      if (item.isGroup && item.questions) {
        if (currentIdx >= flatIndex && currentIdx < flatIndex + item.questions.length) {
          const q = item.questions[currentIdx - flatIndex];
          return {
            question: q,
            groupTitle: item.groupTitle || null,
            groupText: item.groupText || null,
            groupImage: item.groupImageUrl || null,
            groupId: item.groupId || null,
          };
        }
        flatIndex += item.questions.length;
      } else if (item.question) {
        if (currentIdx === flatIndex) {
          return { question: item.question, groupTitle: null, groupText: null, groupImage: null, groupId: null };
        }
        flatIndex++;
      }
    }
    return { question: null, groupTitle: null, groupText: null, groupImage: null, groupId: null };
  };

  if (!isOpen) return null;

  const ctx = getCurrentContext();
  const q = ctx.question;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border p-3 shadow-sm shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 text-primary text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-widest">
            Preview Mode
          </div>
          <div>
            <h1 className="text-base font-bold font-display truncate max-w-xs">{exam.title}</h1>
            <p className="text-xs text-muted-foreground">{exam.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center font-mono text-xl font-bold text-muted-foreground">
            <Clock className="w-5 h-5 mr-1" />
            {exam.durationMinutes}:00
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto p-3 md:p-8 flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Question area */}
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

              {/* Group context — mirrors exactly what students see */}
              {ctx.groupId && (ctx.groupText || ctx.groupImage) && (
                <div className="mb-5 p-4 bg-muted/30 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-bold">{ctx.groupTitle}</span>
                  </div>
                  {ctx.groupText && (
                    <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-line">
                      {ctx.groupText}
                    </p>
                  )}
                  {ctx.groupImage && (
                    <img
                      src={ctx.groupImage}
                      alt="Group illustration"
                      className="max-w-full max-h-56 object-contain rounded-lg mx-auto border border-border"
                    />
                  )}
                </div>
              )}

              {/* Question text + image */}
              <div className="mb-6">
                <h2 className="text-base md:text-2xl font-semibold">{q.text}</h2>
                {q.imageUrl && (
                  <div className="mt-3">
                    <img
                      src={q.imageUrl}
                      alt="Question illustration"
                      className="max-w-full max-h-48 object-contain rounded-lg border border-border mx-auto"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Options — correct answer highlighted green */}
              <div className="space-y-2 md:space-y-3">
                {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                  const val = q[`option${optKey}` as keyof Question] as string;
                  const isCorrect = q.correctOption === optKey;
                  return (
                    <div
                      key={optKey}
                      className={`w-full text-left p-3 md:p-4 rounded-xl border-2 flex items-center gap-2 md:gap-3 ${
                        isCorrect
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-border bg-background'
                      }`}
                    >
                      <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isCorrect ? 'bg-green-500 text-white' : 'bg-muted'
                      }`}>
                        {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : optKey}
                      </div>
                      <span className={`text-sm md:text-lg flex-1 ${isCorrect ? 'font-semibold' : ''}`}>
                        {val}
                      </span>
                      {isCorrect && (
                        <span className="text-xs font-bold text-green-600 shrink-0">Correct</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex justify-between gap-3 mt-6 md:mt-10 pt-4 md:pt-6 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  disabled={currentIdx === flattenedQuestions.length - 1}
                  onClick={() => setCurrentIdx(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              No questions to preview yet.
            </div>
          )}
        </div>

        {/* Sidebar navigation */}
        <div className="w-full md:w-72 shrink-0">
          <div className="p-3 md:p-4 sticky top-0 bg-card rounded-2xl border border-border shadow-sm">
            <h3 className="font-bold text-sm mb-3">Navigation</h3>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {flattenedQuestions.map((sq, idx) => {
                const isCurr = idx === currentIdx;
                return (
                  <button
                    key={sq.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-xl font-bold text-xs md:text-sm transition-all ${
                      isCurr
                        ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t text-center">
              <p className="text-xs text-muted-foreground">
                Correct answers highlighted in green.<br />Students do not see this.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
