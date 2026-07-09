import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Wifi, MonitorDown, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui-elements";

const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === "true";

// Stable download URL — always points to the latest release asset in the
// cbtsoftware-releases repo. Upload a new release asset with the same filename
// to update without changing this URL.
const OFFLINE_DOWNLOAD_URL =
  "https://github.com/adeluav3-ui/cbtsoftware-releases/releases/latest/download/CBT-Software-Local-Setup.exe";

export default function Home() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // In local mode the homepage has no purpose — go straight to login/setup.
  // When already logged in, go to the appropriate dashboard.
  useEffect(() => {
    if (IS_LOCAL) { setLocation("/login"); return; }
    if (!isLoading && user) {
      if (user.role === "super_admin") setLocation("/super-admin");
      else if (user.role === "school_admin") setLocation("/school-admin");
      else if (user.role === "teacher") setLocation("/teacher");
      else setLocation("/student");
    }
  }, [user, isLoading, setLocation]);

  // While loading auth or about to redirect, render nothing
  if (IS_LOCAL || (!isLoading && user)) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border/50 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-display font-bold text-foreground">CBT Software</span>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-linear-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground px-6 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
          Computer-Based Testing
        </h1>
        <p className="text-lg text-primary-foreground/80 max-w-xl mx-auto">
          Conduct professional exams for Nigerian secondary schools — online or
          fully offline when the internet goes out.
        </p>
      </section>

      {/* ── Two Paths ──────────────────────────────────────────────────────── */}
      <section className="flex-1 px-6 py-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Online card */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold mb-1">Online (Cloud)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Access the full platform from any device with an internet connection.
                Results sync in real time, and everything is managed from one place.
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 flex-1">
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />Works in any modern browser</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />Real-time result tracking</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />No installation needed</li>
            </ul>
            <Link href="/login">
              <Button className="w-full mt-2" size="lg">
                Sign In to Cloud Portal
              </Button>
            </Link>
          </div>

          {/* Offline card */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <MonitorDown className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold mb-1">Offline (Local Server)</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run CBT exams on a local computer with no internet required. Students
                connect over Wi-Fi to the local server. Sync results back to cloud
                after the session.
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1 flex-1">
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />No internet needed during exams</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />Up to 50+ students on one Wi-Fi</li>
              <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5 text-secondary/60 flex-shrink-0" />Results sync to cloud when back online</li>
            </ul>
            <a href={OFFLINE_DOWNLOAD_URL} download>
              <Button variant="secondary" className="w-full mt-2" size="lg">
                Download for Windows
              </Button>
            </a>
            <p className="text-xs text-center text-muted-foreground -mt-2">
              Windows 10/11 &nbsp;·&nbsp; Requires a valid school license
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 px-6 py-5 text-center text-xs text-muted-foreground">
        CBT Software &nbsp;·&nbsp; Built for Nigerian secondary schools
      </footer>
    </div>
  );
}
