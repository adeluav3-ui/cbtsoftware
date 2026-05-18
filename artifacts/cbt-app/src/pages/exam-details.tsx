import { useState } from "react";
import { useParams, Link } from "wouter";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useGetExam, useAddQuestion, useDeleteQuestion, useToggleExamStatus, useBulkAddQuestions, type GroupedQuestion } from "@workspace/api-client-react";
import { Card, Button, Modal, Input, Label, Select, Badge } from "@/components/ui-elements";
import { useQueryClient } from "@tanstack/react-query";
import { getGetExamQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Plus, Trash2, HelpCircle, Radio, EyeOff, Upload, Layers, Eye } from "lucide-react";
import { BulkUploadModal } from "@/components/bulk-upload-modal";
import { ExamPreviewModal } from "@/components/exam-preview-modal";

interface GroupMeta {
  groupId: number;
  groupTitle: string;
  groupText: string | null;
  groupImageUrl: string | null;
}

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
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Group modal state
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupText, setGroupText] = useState("");
  const [groupImageUrl, setGroupImageUrl] = useState("");
  const [isUploadingGroupImage, setIsUploadingGroupImage] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Bulk upload modal state
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkGroupMeta, setBulkGroupMeta] = useState<GroupMeta | null>(null);

  // Preview modal state
  const [isPreviewOpen, setPreviewOpen] = useState(false);

  // Extract available groups from exam data
  const getAvailableGroups = (): GroupMeta[] => {
    if (!exam?.questions) return [];
    return (exam.questions as GroupedQuestion[])
      .filter(item => item.isGroup && item.groupId)
      .map(item => ({
        groupId: item.groupId!,
        groupTitle: item.groupTitle || `Group ${item.groupId}`,
        groupText: item.groupText || null,
        groupImageUrl: item.groupImageUrl || null,
      }));
  };

  const availableGroups = getAvailableGroups();

  // Build a map from questionId -> globalIndex (0-based) for cumulative numbering
  const buildQuestionIndexMap = (): Record<number, number> => {
    const map: Record<number, number> = {};
    let idx = 0;
    for (const item of (exam?.questions || []) as GroupedQuestion[]) {
      if (item.isGroup && item.questions) {
        for (const q of item.questions) {
          map[q.id] = idx++;
        }
      } else if (!item.isGroup && item.question) {
        map[item.question.id] = idx++;
      }
    }
    return map;
  };

  const questionIndexMap = buildQuestionIndexMap();

  const flatQuestionCount = Object.keys(questionIndexMap).length;

  const uploadToBackend = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", "question-images");
    const res = await fetch(`${import.meta.env.VITE_API_URL}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) throw new Error("Upload failed");
    const { url } = await res.json();
    return url as string;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      setImageUrl(await uploadToBackend(file));
    } catch {
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleGroupImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGroupImage(true);
    try {
      setGroupImageUrl(await uploadToBackend(file));
    } catch {
      alert("Failed to upload group image. Please try again.");
    } finally {
      setIsUploadingGroupImage(false);
    }
  };

  const closeGroupModal = () => {
    setGroupModalOpen(false);
    setGroupTitle("");
    setGroupText("");
    setGroupImageUrl("");
  };

  const createGroup = async () => {
    if (!groupTitle.trim()) {
      alert("Group title is required.");
      return;
    }
    setCreatingGroup(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${examId}/groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupTitle: groupTitle.trim(),
            groupText: groupText.trim() || null,
            groupImageUrl: groupImageUrl || null,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Failed to create group: ${errorData.error || "Unknown error"}`);
        return;
      }

      const data = await response.json();

      if (exam) {
        const newGroup: GroupedQuestion = {
          isGroup: true,
          groupId: data.groupId,
          groupTitle: data.groupTitle,
          groupText: data.groupText,
          groupImageUrl: data.groupImageUrl,
          questions: [],
        };
        queryClient.setQueryData(getGetExamQueryKey(schoolCode, examId), {
          ...exam,
          questions: [...(exam.questions || []), newGroup],
        });
      }

      closeGroupModal();
    } catch (err) {
      console.error("Failed to create group:", err);
      alert("Network error. Please try again.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const { mutate: bulkAddQuestions, isPending: isBulkPending } = useBulkAddQuestions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(schoolCode, examId) });
        setBulkModalOpen(false);
        setBulkGroupMeta(null);
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
        setSelectedGroupId(null);
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
    const selectedGroup = selectedGroupId ? availableGroups.find(g => g.groupId === selectedGroupId) : null;
    addQuestion({
      schoolCode, examId,
      data: {
        text: qText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correctOpt,
        imageUrl: imageUrl || null,
        groupId: selectedGroupId,
        groupTitle: selectedGroup?.groupTitle || null,
        groupText: selectedGroup?.groupText || null,
        groupImageUrl: selectedGroup?.groupImageUrl || null,
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
            {exam.subject} • Class: {exam.class} • {exam.durationMinutes} mins • {flatQuestionCount} Questions
          </p>
        </div>

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
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={flatQuestionCount === 0}>
            <Eye className="w-4 h-4 mr-2" /> Preview
          </Button>
          <Button variant="outline" onClick={() => setGroupModalOpen(true)}>
            <Layers className="w-4 h-4 mr-2" /> Create Group
          </Button>
          <Button variant="outline" onClick={() => { setBulkGroupMeta(null); setBulkModalOpen(true); }}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      {/* Questions list with groups */}
      <div className="space-y-6">
        {(exam.questions as GroupedQuestion[])?.map((item) => {
          if (item.isGroup && item.questions) {
            const title = item.groupTitle || `Group ${item.groupId}`;
            const meta = availableGroups.find(g => g.groupId === item.groupId);
            return (
              <Card key={`group-${item.groupId}`} className="p-6 border-2 border-primary/20 bg-primary/5">
                <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-primary/20">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Layers className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-primary">{title}</h3>
                      {item.groupText && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.groupText}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.groupImageUrl && (
                      <img src={item.groupImageUrl} alt="Group" className="h-10 w-10 object-cover rounded border" />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkGroupMeta(meta || { groupId: item.groupId!, groupTitle: title, groupText: item.groupText || null, groupImageUrl: item.groupImageUrl || null });
                        setBulkModalOpen(true);
                      }}
                    >
                      <Upload className="w-3 h-3 mr-1" /> Bulk Upload
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {item.questions.map((q) => {
                    const globalNum = (questionIndexMap[q.id] ?? 0) + 1;
                    return (
                      <div key={q.id} className="relative group bg-background rounded-xl p-4 border border-border">
                        <button
                          onClick={() => deleteQuestion({ schoolCode, examId, questionId: q.id })}
                          className="absolute top-2 right-2 p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="flex items-start gap-3">
                          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                            {globalNum}
                          </span>
                          <div className="flex-1 pr-6">
                            <p className="font-medium">{q.text}</p>
                            {q.imageUrl && (
                              <img src={q.imageUrl} alt="Question" className="mt-2 h-32 object-contain rounded border" />
                            )}
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              {['A', 'B', 'C', 'D'].map(opt => (
                                <div key={opt} className={`text-sm p-2 rounded border ${q.correctOption === opt ? 'bg-green-100 border-green-400' : 'bg-muted/20'}`}>
                                  <span className="font-bold">{opt}.</span> {q[`option${opt}` as keyof typeof q] as string}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {item.questions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No questions in this group yet. Use Bulk Upload or Add Question.</p>
                  )}
                </div>
              </Card>
            );
          } else if (!item.isGroup && item.question) {
            const q = item.question;
            const globalNum = (questionIndexMap[q.id] ?? 0) + 1;
            return (
              <Card key={q.id} className="p-6 relative group">
                <button
                  onClick={() => deleteQuestion({ schoolCode, examId, questionId: q.id })}
                  className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex items-start mb-4 pr-10">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold mr-4 shrink-0">
                    {globalNum}
                  </span>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-foreground">{q.text}</p>
                    {q.imageUrl && (
                      <div className="mt-3">
                        <img src={q.imageUrl} alt="Question illustration" className="max-h-48 object-contain rounded-lg border border-border" loading="lazy" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-12">
                  {['A', 'B', 'C', 'D'].map(optKey => {
                    const optVal = q[`option${optKey}` as keyof typeof q];
                    const isCorrect = q.correctOption === optKey;
                    return (
                      <div key={optKey} className={`p-3 rounded-xl border ${isCorrect ? 'bg-success/10 border-success/30 text-success-foreground font-semibold' : 'bg-muted/30 border-border/50 text-muted-foreground'}`}>
                        <span className="font-bold mr-2">{optKey}.</span> {optVal as string}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          }
          return null;
        })}

        {flatQuestionCount === 0 && (
          <div className="py-20 text-center text-muted-foreground bg-muted/20 rounded-3xl border-2 border-dashed border-border">
            <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold text-lg">No questions added yet.</p>
            <p className="text-sm mt-1">Use "Add Question", "Create Group", or "Bulk Upload" to get started.</p>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
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
          <div>
            <Label>Question Image (Optional)</Label>
            <div className="mt-1 flex items-center gap-4">
              <label className={`cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors ${isUploading ? 'opacity-50' : ''}`}>
                <span className="text-sm">Choose Image</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" />
              </label>
              {imageUrl && (
                <div className="relative">
                  <img src={imageUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setImageUrl("")} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 text-xs">×</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Add to Group (Optional)</Label>
            <Select
              value={selectedGroupId?.toString() || ""}
              onChange={e => setSelectedGroupId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">No Group (Individual Question)</option>
              {availableGroups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupTitle}
                </option>
              ))}
            </Select>
            {availableGroups.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No groups created yet. Click "Create Group" to make one.
              </p>
            )}
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

      {/* Create Group Modal */}
      <Modal isOpen={isGroupModalOpen} onClose={closeGroupModal} title="Create Question Group">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use groups for comprehension passages or image-based questions. All questions in a group appear in order, with the group's text and image shown above each question.
          </p>
          <div>
            <Label>Group Title <span className="text-destructive">*</span></Label>
            <Input
              value={groupTitle}
              onChange={e => setGroupTitle(e.target.value)}
              placeholder="e.g. Reading Passage A, Map Questions"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">This title identifies the group and is shown to students.</p>
          </div>
          <div>
            <Label>Passage / Instruction Text (Optional)</Label>
            <textarea
              value={groupText}
              onChange={e => setGroupText(e.target.value)}
              placeholder="e.g. Read the following passage and answer questions 1-5..."
              className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all min-h-24 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">This text appears above every question in the group.</p>
          </div>
          <div>
            <Label>Group Image (Optional)</Label>
            <div className="mt-1 flex items-center gap-4">
              <label className={`cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors text-sm ${isUploadingGroupImage ? 'opacity-50' : ''}`}>
                Upload Image
                <input type="file" accept="image/*" onChange={handleGroupImageUpload} disabled={isUploadingGroupImage} className="hidden" />
              </label>
              {groupImageUrl && (
                <div className="relative">
                  <img src={groupImageUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setGroupImageUrl("")} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 text-xs">×</button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This image appears above every question in the group.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={closeGroupModal} className="flex-1">Cancel</Button>
            <Button onClick={createGroup} isLoading={creatingGroup} className="flex-1">Create Group</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk upload modal */}
      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => { setBulkModalOpen(false); setBulkGroupMeta(null); }}
        onUpload={(questions) => bulkAddQuestions({
          schoolCode, examId, questions,
          groupId: bulkGroupMeta?.groupId ?? null,
          groupTitle: bulkGroupMeta?.groupTitle ?? null,
          groupText: bulkGroupMeta?.groupText ?? null,
          groupImageUrl: bulkGroupMeta?.groupImageUrl ?? null,
        })}
        isPending={isBulkPending}
      />

      {/* Exam preview — full-screen student view with correct answers shown */}
      <ExamPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setPreviewOpen(false)}
        exam={{
          title: exam.title,
          subject: exam.subject,
          durationMinutes: exam.durationMinutes,
          questions: (exam.questions as GroupedQuestion[]) ?? [],
        }}
      />
    </DashboardLayout>
  );
}
