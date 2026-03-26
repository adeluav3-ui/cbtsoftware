import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button, Card, CustomTabs, Input, Label } from "@/components/ui-elements";
import { BookOpen } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [activeTab, setActiveTab] = useState("Student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();
  const { refetch, setUser } = useAuth();

  const { mutate: login, isPending } = useLogin();

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
        // In onSuccess:
        onSuccess: (data) => {
          setUser(data);  // set immediately, no refetch needed
          if (data.role === 'super_admin') setLocation("/super-admin");
          else if (data.role === 'school_admin') setLocation("/school-admin");
          else if (data.role === 'teacher') setLocation("/teacher");
          else setLocation("/student");
        },
        onError: (err: any) => {
          setErrorMsg(err.error || "Login failed. Please check your credentials.");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left side Image */}
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

      {/* Right side form */}
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
              tabs={["Student", "Teacher", "School Admin", "Super Admin"]}
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
                <Input
                  type="password"
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
        <footer className="mt-6 text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">Vortex</span>
        </footer>
      </div>
    </div>
  );
}
