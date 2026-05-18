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

  const [retakeModalOpen, setRetakeModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<{ id: number; title: string } | null>(null);
  const [passcode, setPasscode] = useState("");
  const [retakeError, setRetakeError] = useState("");
  const [isRetaking, setIsRetaking] = useState(false);

  const takenExamIds = new Set(results.map(r => r.examId));
  const availableExams = exams.filter(e => !takenExamIds.has(e.id));

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
        setRetakeError(data.error || "Invalid passcode.");
        return;
      }
      await refetchResults();
      setRetakeModalOpen(false);
      setPasscode("");
      setSelectedExam(null);
    } catch (err) {
      setRetakeError("Network error.");
    } finally {
      setIsRetaking(false);
    }
  };

  const openRetakeModal = (examId: number, examTitle: string) => {
    setSelectedExam({ id: examId, title: examTitle });
    setPasscode("");
    setRetakeError("");
    setRetakeModalOpen(true);
  };

  return (
    <DashboardLayout allowedRoles={["student"]}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Student Portal</h1>
        <p className="text-sm text-muted-foreground mt-1">Class: <span className="font-semibold text-primary">{studentClass}</span></p>
      </div>

      <h2 className="text-lg md:text-xl font-bold mb-3">Available Exams</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {isLoading && <div className="col-span-full text-center py-8">Loading exams...</div>}
        {!isLoading && availableExams.length === 0 && (
          <Card className="col-span-full py-8 text-center text-muted-foreground">
            No active exams available for your class.
          </Card>
        )}
        {availableExams.map(exam => (
          <Card key={exam.id} className="flex flex-col p-4">
            <Badge variant="success" className="w-fit mb-3 text-xs">Active</Badge>
            <h3 className="text-lg md:text-xl font-bold font-display mb-1">{exam.title}</h3>
            <p className="text-primary font-semibold text-xs mb-3">{exam.subject}</p>
            <div className="flex items-center text-xs text-muted-foreground mb-4">
              <Clock className="w-3 h-3 mr-1" /> {exam.durationMinutes} minutes
            </div>
            <Button size="sm" className="w-full" onClick={() => setLocation(`/exam/${exam.id}`)}>
              <PlayCircle className="w-4 h-4 mr-2" /> Start
            </Button>
          </Card>
        ))}
      </div>

      <h2 className="text-lg md:text-xl font-bold mb-3">Your Results</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8">You haven't taken any exams yet.</div>
        )}
        {results.map(result => (
          <Card key={result.id} className="flex items-center p-3 md:p-4">
            <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center mr-3 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate">{result.examTitle || result.subject}</h3>
              <p className="text-xs text-muted-foreground">Score: {result.score} / {result.totalQuestions}</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <div className="text-xl font-bold text-primary">{result.percentage}%</div>
              <Button variant="outline" size="sm" className="p-1.5" onClick={() => openRetakeModal(result.examId, result.examTitle || result.subject || '')}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Retake Modal */}
      <Modal isOpen={retakeModalOpen} onClose={() => setRetakeModalOpen(false)} title={`Retake: ${selectedExam?.title}`}>
        <div className="space-y-3">
          <p className="text-sm">Enter the school's retake passcode.</p>
          <div>
            <label className="block text-sm font-medium mb-1">4-Digit Passcode</label>
            <Input type="password" maxLength={4} placeholder="Enter code" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="text-center text-xl tracking-widest" />
          </div>
          {retakeError && <div className="bg-destructive/10 text-destructive p-2 rounded text-sm">{retakeError}</div>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setRetakeModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleRetakeRequest} isLoading={isRetaking} className="flex-1">Confirm</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}