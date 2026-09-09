import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin, getCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, CustomTabs, Input, Label, PasswordInput } from "@/components/ui-elements";
import { BookOpen, Upload, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

const API = (import.meta.env.VITE_API_URL as string) || "https://cbtsoftware.onrender.com/api";
// IS_LOCAL must be an explicit opt-in build flag (set only by build-local.mjs).
// Never derive it from the API URL shape — Vercel's proxy rewrite also uses
// relative /api paths, so URL shape is not a reliable cloud vs local signal.
const IS_LOCAL = import.meta.env.VITE_LOCAL_MODE === "true";

export default function Login() {
  const [activeTab, setActiveTab] = useState("Student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState(() => localStorage.getItem("cbt_school_code") ?? "");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();
  const { refetch, setUser } = useAuth();
  const queryClient = useQueryClient();

  // Local-mode setup state
  const [setupChecked, setSetupChecked] = useState(!IS_LOCAL);
  const [hasSchool, setHasSchool] = useState(!IS_LOCAL);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);

  const { mutate: login, isPending } = useLogin();

  useEffect(() => {
    if (!IS_LOCAL) return;
    fetch(`${API}/setup-status`)
      .then(r => r.json())
      .then((data: { hasSchool: boolean }) => {
        setHasSchool(data.hasSchool);
        setSetupChecked(true);
      })
      .catch(() => {
        // Network error — safe default: show login form, never setup screen
        setHasSchool(true);
        setSetupChecked(true);
      });
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportError("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data?.school?.code) throw new Error("Invalid export file — school code missing");
      const res = await fetch(`${API}/schools/${data.school.code}/sync/import-school`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Import failed");
      setImportSuccess(true);
      setHasSchool(true);
    } catch (err: any) {
      setImportError(err.message || "Import failed");
    } finally {
      setImportLoading(false);
      // Reset the file input so the same file can be re-selected after an error
      e.target.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    login(
      {
        username,
        password,
        ...(activeTab !== "Super Admin" && { schoolCode })
      },
      {
        onSuccess: (data) => {
          if (schoolCode) localStorage.setItem("cbt_school_code", schoolCode.toUpperCase());
          queryClient.setQueryData(getCurrentUserQueryKey(), data);
          setUser(data);
          if (data.role === 'super_admin') setLocation("/super-admin");
          else if (data.role === 'school_admin') setLocation("/school-admin");
          else if (data.role === 'teacher') setLocation("/teacher");
          else setLocation("/student");
        },
        onError: (err: any) => {
          if (!err.status) {
            setErrorMsg("Could not reach the server. Please check your connection and try again.");
          } else if (err.status >= 500) {
            setErrorMsg("The server encountered an error. Please try again in a moment.");
          } else {
            const msg = (err.data as any)?.error;
            setErrorMsg(msg || "Invalid username or password.");
          }
        }
      }
    );
  };

  // Tabs: hide Super Admin in local builds
  const tabs = IS_LOCAL
    ? ["Student", "Teacher", "School Admin"]
    : ["Student", "Teacher", "School Admin", "Super Admin"];

  const heroSection = (
    <div className="hidden lg:flex w-1/2 relative bg-primary/5 items-center justify-center overflow-hidden">
      <img
        src={`${import.meta.env.BASE_URL}images/login-hero.png`}
        alt="Education Technology"
        className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-multiply"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <div className="relative z-10 p-12 text-center max-w-lg">
        <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl border border-white/30">
          <BookOpen className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-5xl font-bold font-display text-foreground leading-tight mb-4">
          Next Generation Assessment
        </h1>
        <p className="text-lg text-muted-foreground">
          A secure, reliable, and powerful platform for seamless computer-based testing across all your institutions.
        </p>
      </div>
    </div>
  );

  // ── Local mode: show setup screen when no school has been imported yet ─────
  if (IS_LOCAL && setupChecked && !hasSchool) {
    return (
      <div className="min-h-screen w-full flex bg-background">
        {heroSection}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold font-display text-foreground">Set Up Local Server</h2>
              <p className="text-muted-foreground mt-2">
                No school has been imported yet. Upload the export file from your cloud admin panel to get started.
              </p>
            </div>

            <Card className="p-8 space-y-5">
              {importSuccess ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                  <p className="text-center font-semibold text-foreground">School data imported successfully!</p>
                  <p className="text-sm text-muted-foreground text-center">You can now log in with your school admin credentials.</p>
                  <Button className="w-full" onClick={() => window.location.reload()}>
                    Continue to Login
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">How to get the export file:</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Log in to the cloud admin panel</li>
                      <li>Go to your school &rsaquo; <span className="font-medium">Export for Offline Use</span></li>
                      <li>Download the <code className="bg-muted px-1 rounded text-xs">.json</code> file</li>
                      <li>Upload it below</li>
                    </ol>
                  </div>

                  {importError && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20">
                      {importError}
                    </div>
                  )}

                  <label className="block">
                    <div className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${importLoading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:bg-primary/5 border-border"}`}>
                      <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                      <span className="text-sm font-medium text-foreground">
                        {importLoading ? "Importing…" : "Click to upload school export file"}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">.json file from cloud export</span>
                    </div>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      onChange={handleImport}
                      disabled={importLoading}
                    />
                  </label>
                </>
              )}
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Normal login form ──────────────────────────────────────────────────────
  if (!setupChecked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {heroSection}

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold font-display text-foreground">Welcome Back</h2>
            <p className="text-muted-foreground mt-2">Sign in to your account to continue</p>
          </div>

          <div className="flex justify-center mb-8">
            <CustomTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(t) => {
                setActiveTab(t);
                setErrorMsg("");
              }}
            />
          </div>

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20 text-center">
                  {errorMsg}
                </div>
              )}

              {activeTab !== "Super Admin" && (
                <div>
                  <Label>School Code</Label>
                  <Input
                    value={schoolCode}
                    onChange={e => setSchoolCode(e.target.value)}
                    placeholder="Enter school code"
                    required
                  />
                </div>
              )}

              <div>
                <Label>Username</Label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div>
                <Label>Password</Label>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full mt-4" size="lg" isLoading={isPending}>
                Sign In
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
      <footer className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
        Powered by{' '}
        <a
          href="https://compile-eight.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary hover:underline transition-colors"
        >
          Compile
        </a>
      </footer>
    </div>
  );
}
