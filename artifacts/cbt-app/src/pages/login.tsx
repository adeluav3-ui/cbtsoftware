import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin, getCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, CustomTabs, Input, Label, PasswordInput } from "@/components/ui-elements";
import { BookOpen, Upload, CheckCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";
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

  // License activation state
  const [licenseData, setLicenseData] = useState<any>(null);
  const [licenseError, setLicenseError] = useState("");
  const [activationStep, setActivationStep] = useState<"license" | "details">("license");
  const [schoolName, setSchoolName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState("");
  const [activationSuccess, setActivationSuccess] = useState(false);

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

  const handleLicenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicenseError("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data?.type !== "cbt-offline-license") {
        throw new Error("This is not a valid CBT Software license file");
      }
      if (!data.schoolCode) throw new Error("License file is missing school code");
      // Basic expiry check on the frontend too
      if (data.validUntil && new Date(data.validUntil) < new Date()) {
        throw new Error("This license has expired. Contact your administrator for a renewal.");
      }
      setLicenseData(data);
      setActivationStep("details");
    } catch (err: any) {
      setLicenseError(err.message || "Could not read license file");
    } finally {
      e.target.value = "";
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivationError("");
    if (adminPassword !== adminPasswordConfirm) {
      setActivationError("Passwords do not match");
      return;
    }
    if (adminPassword.length < 6) {
      setActivationError("Password must be at least 6 characters");
      return;
    }
    setActivating(true);
    try {
      const res = await fetch(`${API}/setup/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          license: licenseData,
          schoolName,
          adminFullName,
          adminUsername: adminUsername.trim().toLowerCase(),
          adminPassword,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.detail || "Activation failed");
      setActivationSuccess(true);
      setHasSchool(true);
    } catch (err: any) {
      setActivationError(err.message || "Activation failed");
    } finally {
      setActivating(false);
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

  // ── Local mode: show activation screen when no school set up yet ───────────
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
            {/* Success */}
            {activationSuccess ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold font-display text-foreground">Activated!</h2>
                </div>
                <Card className="p-8">
                  <div className="flex flex-col items-center gap-4 py-4">
                    <CheckCircle className="w-14 h-14 text-green-500" />
                    <p className="text-center font-semibold text-foreground text-lg">
                      Your school has been set up successfully!
                    </p>
                    <p className="text-sm text-muted-foreground text-center">
                      Log in with the admin username and password you just created.
                    </p>
                    <Button className="w-full mt-2" onClick={() => window.location.reload()}>
                      Go to Login
                    </Button>
                  </div>
                </Card>
              </>
            ) : activationStep === "license" ? (
              /* Step 1: Upload license */
              <>
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold font-display text-foreground">Activate Software</h2>
                  <p className="text-muted-foreground mt-2">
                    Upload the license file sent to you by the administrator after payment.
                  </p>
                </div>
                <Card className="p-8 space-y-5">
                  <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-4">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">How to get your license:</p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Make payment to the administrator</li>
                        <li>Send your payment receipt and the number of devices needed</li>
                        <li>Receive your <code className="bg-muted px-1 rounded text-xs">.json</code> license file</li>
                        <li>Upload it below to activate</li>
                      </ol>
                    </div>
                  </div>

                  {licenseError && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20">
                      {licenseError}
                    </div>
                  )}

                  <label className="block">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors hover:border-primary hover:bg-primary/5 border-border">
                      <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                      <span className="text-sm font-medium text-foreground">Click to upload your license file</span>
                      <span className="text-xs text-muted-foreground mt-1">cbt-license-YOURCODE.json</span>
                    </div>
                    <input
                      type="file"
                      accept=".json,application/json"
                      className="sr-only"
                      onChange={handleLicenseUpload}
                    />
                  </label>
                </Card>
              </>
            ) : (
              /* Step 2: Fill school + admin details */
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full text-sm font-medium mb-4">
                    <CheckCircle className="w-4 h-4" />
                    License verified
                  </div>
                  <h2 className="text-3xl font-bold font-display text-foreground">Set Up Your School</h2>
                  <p className="text-muted-foreground mt-2">
                    Fill in your school details to complete activation.
                  </p>
                </div>

                <Card className="p-8">
                  {/* License summary */}
                  <div className="bg-muted/50 rounded-xl p-3 mb-5 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">School Code: </span>
                      <span className="font-bold text-foreground">{licenseData?.schoolCode}</span>
                    </div>
                    {licenseData?.maxDevices && (
                      <div>
                        <span className="text-muted-foreground">Devices: </span>
                        <span className="font-bold text-foreground">{licenseData.maxDevices}</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleActivate} className="space-y-4">
                    {activationError && (
                      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl text-sm font-semibold border border-destructive/20">
                        {activationError}
                      </div>
                    )}

                    <div>
                      <Label>School Name</Label>
                      <Input
                        value={schoolName}
                        onChange={e => setSchoolName(e.target.value)}
                        placeholder="e.g. Greenfield Academy"
                        required
                      />
                    </div>

                    <div>
                      <Label>Admin Full Name</Label>
                      <Input
                        value={adminFullName}
                        onChange={e => setAdminFullName(e.target.value)}
                        placeholder="Your full name"
                        required
                      />
                    </div>

                    <div>
                      <Label>Admin Username</Label>
                      <Input
                        value={adminUsername}
                        onChange={e => setAdminUsername(e.target.value)}
                        placeholder="Choose a username (e.g. admin)"
                        required
                      />
                    </div>

                    <div>
                      <Label>Admin Password</Label>
                      <div className="relative">
                        <PasswordInput
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Confirm Password</Label>
                      <PasswordInput
                        value={adminPasswordConfirm}
                        onChange={e => setAdminPasswordConfirm(e.target.value)}
                        placeholder="Re-enter password"
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => { setActivationStep("license"); setLicenseData(null); setActivationError(""); }}
                      >
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" isLoading={activating}>
                        Activate
                      </Button>
                    </div>
                  </form>
                </Card>
              </>
            )}
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
