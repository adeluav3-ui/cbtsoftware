import { useState } from "react";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useGetExam, useAddQuestion, useDeleteQuestion, useToggleExamStatus } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Select, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getGetExamQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Plus, Trash2, HelpCircle, Radio, EyeOff } from "lucide-react";

export default function TeacherExamDetails() {
  const { examId: rawExamId } = useParams();
  const examId = parseInt(rawExamId || "0");
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const queryClient = useQueryClient();

  const { data: exam, isLoading } = useGetExam(schoolCode, examId);

  const [isModalOpen, setModalOpen] = useState(false);
  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOpt, setCorrectOpt] = useState<"A" | "B" | "C" | "D">("A");

  const { mutate: addQuestion, isPending } = useAddQuestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) });
        setModalOpen(false);
        setQText(""); setOptA(""); setOptB(""); setOptC(""); setOptD(""); setCorrectOpt("A");
      }
    }
  });

  const { mutate: deleteQuestion } = useDeleteQuestion({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) }) }
  });

  const { mutate: toggleStatus, isPending: isToggling } = useToggleExamStatus({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) }) }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addQuestion({
      schoolCode, examId,
      data: { text: qText, optionA: optA, optionB: optB, optionC: optC, optionD: optD, correctOption: correctOpt }
    });
  };

  if (isLoading || !exam) return <DashboardLayout allowedRoles={["teacher", "school_admin"]}><div className="p-10">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
      <Link href="/teacher" className="inline-flex items-center text-sm font-semibold text-primary hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Exams
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-display font-bold">{exam.title}</h1>
            <Badge variant={exam.isActive ? "success" : "default"}>
              {exam.isActive ? "Live" : "Draft"}
            </Badge>
          </div>
          <p className="text-muted-foreground font-semibold">
            {exam.subject} • Class: {exam.class} • {exam.durationMinutes} mins • {exam.questions.length} Questions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exam.isActive ? (
            <Button
              variant="outline"
              onClick={() => toggleStatus({ schoolCode, examId, isActive: false })}
              isLoading={isToggling}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <EyeOff className="w-4 h-4 mr-2" /> Unpublish
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => toggleStatus({ schoolCode, examId, isActive: true })}
              isLoading={isToggling}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/25"
            >
              <Radio className="w-4 h-4 mr-2" /> Publish Exam
            </Button>
          )}
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {exam.questions.map((q, i) => (
          <Card key={q.id} className="p-6 relative group">
            <button
              onClick={() => deleteQuestion({ schoolCode, examId, questionId: q.id })}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="flex items-start mb-4 pr-10">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold mr-4 shrink-0">
                {i + 1}
              </span>
              <p className="text-lg font-semibold text-foreground">{q.text}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
              {['A', 'B', 'C', 'D'].map(optKey => {
                const optVal = q[`option${optKey}` as keyof typeof q];
                const isCorrect = q.correctOption === optKey;
                return (
                  <div key={optKey} className={`p-3 rounded-xl border ${isCorrect ? 'bg-success/10 border-success/30 text-success-foreground font-semibold' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                    <span className="font-bold mr-2">{optKey}.</span> {optVal}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}

        {exam.questions.length === 0 && (
          <div className="py-20 text-center text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed border-border">
            <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">No questions added yet.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add New Question">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <Label>Question Text</Label>
            <textarea
              value={qText}
              onChange={e => setQText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all min-h-[100px]"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Option A</Label><Input value={optA} onChange={e => setOptA(e.target.value)} required /></div>
            <div><Label>Option B</Label><Input value={optB} onChange={e => setOptB(e.target.value)} required /></div>
            <div><Label>Option C</Label><Input value={optC} onChange={e => setOptC(e.target.value)} required /></div>
            <div><Label>Option D</Label><Input value={optD} onChange={e => setOptD(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Correct Option</Label>
            <Select value={correctOpt} onChange={e => setCorrectOpt(e.target.value as any)}>
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
            </Select>
          </div>
          <Button type="submit" className="w-full mt-4" isLoading={isPending}>Save Question</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
