import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";

// Pages
import Login from "@/pages/login";
import SuperAdminDashboard from "@/pages/super-admin";
import SchoolAdminDashboard from "@/pages/school-admin";
import TeacherDashboard from "@/pages/teacher";
import TeacherExamDetails from "@/pages/exam-details";
import StudentDashboard from "@/pages/student";
import TakeExam from "@/pages/take-exam";
import NotFound from "@/pages/not-found";
import ExamResults from "@/pages/teacher/ExamResults";
import ComprehensiveResults from "@/pages/student/ComprehensiveResults";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;

  if (user.role === 'super_admin') return <Redirect to="/super-admin" />;
  if (user.role === 'school_admin') return <Redirect to="/school-admin" />;
  if (user.role === 'teacher') return <Redirect to="/teacher" />;
  return <Redirect to="/student" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      {/* Protected Routes inside Dashboards check their own auth */}
      <Route path="/super-admin" component={SuperAdminDashboard} />
      <Route path="/school-admin" component={SchoolAdminDashboard} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/teacher/exams/:examId" component={TeacherExamDetails} />
      <Route path="/student" component={StudentDashboard} />
      <Route path="/exam/:examId" component={TakeExam} />
      <Route path="/teacher/exams/:examId/results" component={ExamResults} />
      <Route path="/comprehensive-results" component={ComprehensiveResults} />

      <Route path="/" component={RootRedirect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
