import { ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { Building, LayoutDashboard, BookOpen, PenTool, LogOut, Loader2, UserCircle } from "lucide-react";
import { cn } from "./ui-elements";

export function DashboardLayout({ children, allowedRoles }: { children: ReactNode, allowedRoles: string[] }) {
  const { user, isLoading, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        refetch();
        setLocation("/login");
      }
    }
  });

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (!allowedRoles.includes(user.role)) {
        if (user.role === 'super_admin') setLocation("/super-admin");
        else if (user.role === 'school_admin') setLocation("/school-admin");
        else if (user.role === 'teacher') setLocation("/teacher");
        else setLocation("/student");
      }
    }
  }, [user, isLoading, allowedRoles, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const navItems = {
    super_admin: [{ title: "Schools", path: "/super-admin", icon: Building }],
    school_admin: [{ title: "Dashboard", path: "/school-admin", icon: LayoutDashboard }],
    teacher: [{ title: "Dashboard", path: "/teacher", icon: BookOpen }],
    student: [{ title: "My Exams", path: "/student", icon: PenTool }],
  }[user.role] || [];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-card border-r border-border flex flex-col justify-between shadow-2xl shadow-black/5 z-20">
        <div>
          <div className="p-8 pb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-display text-primary">CBT Portal</h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {user.schoolName || "Global Administration"}
            </p>
          </div>
          
          <nav className="px-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path} className="block">
                  <div className={cn(
                    "flex items-center px-4 py-3.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer group",
                    window.location.pathname.startsWith(item.path)
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}>
                    <Icon className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
                    {item.title}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-6 border-t border-border/50 bg-muted/20">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mr-3">
              <UserCircle className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="font-bold text-sm truncate">{user.fullName || user.username}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
        <div className="p-8 md:p-12 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
