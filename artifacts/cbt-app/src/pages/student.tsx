import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListExams, useListResults } from "@workspace/api-client-react";
import { Card, Button, Badge } from "@/components/ui-elements";
import { useLocation } from "wouter";
import { Clock, CheckCircle2, PlayCircle } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const schoolCode = user?.schoolCode || "";
  const studentClass = user?.class || "";

  const { data: exams = [], isLoading } = useListExams(schoolCode, { active: true, class: studentClass });
  const { data: results = [] } = useListResults(schoolCode, { studentId: user?.id });

  const takenExamIds = new Set(results.map(r => r.examId));
  const availableExams = exams.filter(e => !takenExamIds.has(e.id));

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
          <Card key={exam.id} className="flex flex-col border-primary/20 bg-gradient-to-br from-card to-primary/5">
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
            <div className="text-right">
              <div className="text-2xl font-bold font-display text-primary">{result.percentage}%</div>
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
