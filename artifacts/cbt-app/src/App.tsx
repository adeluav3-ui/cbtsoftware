import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/feedback";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { LicenseLock } from "@/components/LicenseLock";
import { ErrorBoundary, PageErrorBoundary } from "@/components/ErrorBoundary";

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
import { LocalStatusBar } from "@/components/LocalStatusBar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function wrap(Component: React.ComponentType<any>) {
  return (props: any) => (
    <PageErrorBoundary>
      <Component {...props} />
    </PageErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={wrap(Login)} />

      <Route path="/super-admin" component={wrap(SuperAdminDashboard)} />
      <Route path="/school-admin/:category/:tab" component={wrap(SchoolAdminDashboard)} />
      <Route path="/school-admin" component={wrap(SchoolAdminDashboard)} />
      <Route path="/teacher" component={wrap(TeacherDashboard)} />
      <Route path="/teacher/exams/:examId" component={wrap(TeacherExamDetails)} />
      <Route path="/student" component={wrap(StudentDashboard)} />
      <Route path="/exam/:examId" component={wrap(TakeExam)} />
      <Route path="/teacher/exams/:examId/results" component={wrap(ExamResults)} />
      <Route path="/comprehensive-results" component={wrap(ComprehensiveResults)} />
      <Route path="/student/results" component={wrap(MyResults)} />

      <Route path="/local-info" component={wrap(LocalServerInfo)} />
      <Route path="/" component={wrap(Home)} />
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
        // Await the body before doing anything else — this ensures setLicenseLock
        // fires before any query function can process the bad response.
        const data: { error?: string; licenseValidUntil?: string | null } =
          await res.json().catch(() => ({}));
        if (data.error === "CLOCK_TAMPER" || data.error === "LICENSE_EXPIRED") {
          setLicenseLock({ error: data.error, licenseValidUntil: data.licenseValidUntil });
        }
        // Throw so TanStack Query puts queries into error state instead of
        // storing the error body as data. Components that call .map() on data
        // would otherwise crash because they receive { error: "..." } not [].
        throw Object.assign(new Error(data.error ?? "locked"), { status: 423 });
      }
      return res;
    };
    return () => { window.fetch = orig; };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {licenseLock && <LicenseLock error={licenseLock.error} licenseValidUntil={licenseLock.licenseValidUntil} />}
        <AuthProvider>
          <LocalStatusBar />
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
