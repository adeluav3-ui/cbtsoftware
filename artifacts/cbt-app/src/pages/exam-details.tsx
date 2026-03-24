import { useState } from "react";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useGetExam, useAddQuestion, useDeleteQuestion, useToggleExamStatus, useBulkAddQuestions } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Select, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getGetExamQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Plus, Trash2, HelpCircle, Radio, EyeOff, Upload } from "lucide-react";
import { BulkUploadModal } from "@/components/bulk-upload-modal";
import { supabase } from "@/lib/supabase";

export default function TeacherExamDetails() {
  const { examId: rawExamId } = useParams();
  const examId = parseInt(rawExamId || "0");
  const { user } = useAuth();
  const schoolCode = user?.schoolCode || "";
  const queryClient = useQueryClient();

  const { data: exam, isLoading } = useGetExam(schoolCode, examId);

  // Single question modal state
  const [isModalOpen, setModalOpen] = useState(false);
  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOpt, setCorrectOpt] = useState<"A" | "B" | "C" | "D">("A");
  const [imageUrl, setImageUrl] = useState(""); // NEW: for image URL
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `questions/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('question-images') // Create this bucket first in Supabase
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('question-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Bulk upload modal state
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);

  const { mutate: bulkAddQuestions, isPending: isBulkPending } = useBulkAddQuestions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) });
        setBulkModalOpen(false);
      }
    }
  });

  const { mutate: addQuestion, isPending } = useAddQuestion({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) });
        setModalOpen(false);
        setQText("");
        setOptA("");
        setOptB("");
        setOptC("");
        setOptD("");
        setCorrectOpt("A");
        setImageUrl("");
      }
    }
  });

  const { mutate: deleteQuestion } = useDeleteQuestion({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) })
    }
  });

  const { mutate: toggleStatus, isPending: isToggling } = useToggleExamStatus({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) })
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addQuestion({
      schoolCode, examId,
      data: {
        text: qText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correctOpt,
        imageUrl: imageUrl || null  // Add this line
      }
    });
  };

  if (isLoading || !exam) {
    return (
      <DashboardLayout allowedRoles={["teacher", "school_admin"]}>
        <div className="p-10 text-muted-foreground">Loading exam...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={["teacher", "school_admin"]}>

      {/* Back link */}
      <Link href="/teacher" className="inline-flex items-center text-sm font-semibold text-primary hover:underline mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Exams
      </Link>

      {/* Header */}
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

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
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
          <Button variant="outline" onClick={() => setBulkModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      {/* Questions list */}
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
                  <div
                    key={optKey}
                    className={`p-3 rounded-xl border ${isCorrect
                      ? 'bg-success/10 border-success/30 text-success-foreground font-semibold'
                      : 'bg-muted/30 border-border/50 text-muted-foreground'
                      }`}
                  >
                    <span className="font-bold mr-2">{optKey}.</span> {optVal as string}
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
            <p className="text-sm mt-1">Use "Add Question" or "Bulk Upload" to get started.</p>
          </div>
        )}
      </div>

      {/* Single question modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Add New Question">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <Label>Question Text</Label>
            <textarea
              value={qText}
              onChange={e => setQText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all min-h-25"
              required
            />
          </div>
          {/* NEW: Image Upload Section */}
          <div>
            <Label>Question Image (Optional)</Label>
            <div className="mt-1 flex items-center gap-4">
              <label className={`cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors ${isUploading ? 'opacity-50' : ''}`}>
                <span className="text-sm">Choose Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              {imageUrl && (
                <div className="relative">
                  <img src={imageUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Option A</Label><Input value={optA} onChange={e => setOptA(e.target.value)} required /></div>
            <div><Label>Option B</Label><Input value={optB} onChange={e => setOptB(e.target.value)} required /></div>
            <div><Label>Option C</Label><Input value={optC} onChange={e => setOptC(e.target.value)} required /></div>
            <div><Label>Option D</Label><Input value={optD} onChange={e => setOptD(e.target.value)} required /></div>
          </div>
          <div>
            <Label>Correct Option</Label>
            <Select value={correctOpt} onChange={e => setCorrectOpt(e.target.value as "A" | "B" | "C" | "D")}>
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
            </Select>
          </div>
          <Button type="submit" className="w-full mt-4" isLoading={isPending}>Save Question</Button>
        </form>
      </Modal>

      {/* Bulk upload modal */}
      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onUpload={(questions) => bulkAddQuestions({ schoolCode, examId, questions })}
        isPending={isBulkPending}
      />

    </DashboardLayout>
  );
}