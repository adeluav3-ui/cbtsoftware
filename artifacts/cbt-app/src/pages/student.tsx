import { useState } from "react";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListExams, useListResults } from "@workspace/api-client-react";
import { Card, Button, Badge, Modal, Input } from "@/components/ui-elements";
import { useLocation } from "wouter";
import { Clock, CheckCircle2, PlayCircle, RotateCcw } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const schoolCode = user?.schoolCode || "";
  const studentClass = user?.class || "";

  const { data: exams = [], isLoading } = useListExams(schoolCode, { active: true, class: studentClass });
  const { data: results = [], refetch: refetchResults } = useListResults(schoolCode, { studentId: user?.id });

  // Retake modal state
  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: number; title: string } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [retakeError, setRetakeError] = useState("");
  const [isRetaking, setIsRetaking] = useState(false);

  const takenExamIds = new Set(results.map(r => r.examId));
  const availableExams = exams.filter(e => !takenExamIds.has(e.id));

  // Handle retake request
  const handleRetakeRequest = async () => {
    if (!selectedExam || !user) return;

    setIsRetaking(true);
    setRetakeError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/schools/${schoolCode}/exams/${selectedExam.id}/retake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.id, passcode }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        setRetakeError(data.error || "Invalid passcode. Please try again.");
        return;
      }

      // Success - refresh results and close modal
      await refetchResults();
      setRetakeModalOpen(false);
      setPasscode("");
      setSelectedExam(null);

    } catch (err) {
      setRetakeError("Network error. Please try again.");
    } finally {
      setIsRetaking(false);
    }
  };

  // Open retake modal for a specific exam
  const openRetakeModal = (examId: number, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setPasscode("");
    setRetakeError("");
    setRetakeModalOpen(true);
  };

  return (
    <DashboardLayout allowedRoles={["student"]}>
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold">Student Portal</h1>
        <p className="text-muted-foreground mt-1">Class: <span className="font-semibold text-primary">{studentClass}</span></p>
      </div>

      <h2 className="text-xl font-bold mb-4 font-display">Available Exams</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {isLoading && <div className="col-span-full">Loading exams...</div>}
        {!isLoading && availableExams.length === 0 && (
          <Card className="col-span-full py-12 text-center text-muted-foreground bg-muted/30">
            No active exams available for your class at the moment.
          </Card>
        )}
        {availableExams.map(exam => (
          <Card key={exam.id} className="flex flex-col border-primary/20 bg-linear-to-br from-card to-primary/5">
            <Badge variant="success" className="w-max mb-4">Active Now</Badge>
            <h3 className="text-2xl font-bold font-display mb-1">{exam.title}</h3>
            <p className="text-primary font-semibold mb-4">{exam.subject}</p>

            <div className="flex items-center text-sm text-muted-foreground mb-6">
              <Clock className="w-4 h-4 mr-2" /> {exam.durationMinutes} Minutes
            </div>

            <Button className="w-full mt-auto" onClick={() => setLocation(`/exam/${exam.id}`)}>
              <PlayCircle className="w-5 h-5 mr-2" /> Start Exam
            </Button>
          </Card>
        ))}
      </div>

      <h2 className="text-xl font-bold mb-4 font-display">Your Results</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.length === 0 && (
          <div className="col-span-full text-muted-foreground">You haven't taken any exams yet.</div>
        )}
        {results.map(result => (
          <Card key={result.id} className="flex items-center p-6 bg-muted/10">
            <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mr-4 shrink-0">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{result.examTitle || result.subject}</h3>
              <p className="text-sm text-muted-foreground">Score: {result.score} / {result.totalQuestions}</p>
            </div>
            <div className="text-right flex items-center gap-3">
              <div className="text-2xl font-bold font-display text-primary">{result.percentage}%</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openRetakeModal(result.examId, result.examTitle || result.subject)}
                className="ml-2"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Retake
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Retake Modal */}
      <Modal
        isOpen={retakeModalOpen}
        onClose={() => setRetakeModalOpen(false)}
        title={`Retake Exam: ${selectedExam?.title}`}
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            To retake this exam, please enter the school's retake passcode.
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">4-Digit Passcode</label>
            <Input
              type="password"
              maxLength={4}
              placeholder="Enter passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          {retakeError && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {retakeError}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setRetakeModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleRetakeRequest}
              isLoading={isRetaking}
              className="flex-1"
            >
              Confirm Retake
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}