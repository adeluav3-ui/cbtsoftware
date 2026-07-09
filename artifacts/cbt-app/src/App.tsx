import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { LicenseLock } from "@/components/LicenseLock";

const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === "true";

// Pages
import Home from "@/pages/home";
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
import MyResults from "@/pages/student/MyResults";
import LocalServerInfo from "@/pages/local-server-info";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

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
      <Route path="/student/results" component={MyResults} />

      <Route path="/local-info" component={LocalServerInfo} />
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [licenseLock, setLicenseLock] = useState<{
    error: "CLOCK_TAMPER" | "LICENSE_EXPIRED";
    licenseValidUntil?: string | null;
  } | null>(null);

  // Intercept all 423 responses and show the lock screen (local mode only)
  useEffect(() => {
    if (!IS_LOCAL) return;
    const orig = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await orig(...args);
      if (res.status === 423) {
        res.clone().json().then((data: { error?: string; licenseValidUntil?: string | null }) => {
          if (data.error === "CLOCK_TAMPER" || data.error === "LICENSE_EXPIRED") {
            setLicenseLock({ error: data.error, licenseValidUntil: data.licenseValidUntil });
          }
        }).catch(() => {});
      }
      return res;
    };
    return () => { window.fetch = orig; };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {licenseLock && <LicenseLock error={licenseLock.error} licenseValidUntil={licenseLock.licenseValidUntil} />}
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
