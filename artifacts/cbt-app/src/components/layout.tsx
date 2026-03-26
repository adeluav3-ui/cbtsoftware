import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { Building, LayoutDashboard, BookOpen, PenTool, LogOut, Loader2, UserCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./ui-elements";

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-white px-6 py-3 rounded-xl shadow-lg font-semibold text-sm z-50">
      You are offline — some features may be unavailable
    </div>
  );
}


export function DashboardLayout({ children, allowedRoles }: { children: ReactNode, allowedRoles: string[] }) {
  const { user, isLoading, refetch, setUser, } = useAuth();
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        setUser(null);   // clear local user
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
      <aside
        className={cn(
          "bg-card border-r border-border flex flex-col justify-between shadow-2xl shadow-black/5 z-20 transition-all duration-300 ease-in-out relative",
          collapsed ? "w-20" : "w-72"
        )}
      >
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3.5 top-8 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors z-30"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div>
          {/* Logo area */}
          <div className={cn("p-6 pb-5 transition-all duration-300", collapsed && "px-4 flex justify-center")}>
            {collapsed ? (
              <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold font-display text-primary">CBT Portal</h1>
                <p className="text-sm font-medium text-muted-foreground mt-1 truncate">
                  {user.schoolName || "Global Administration"}
                </p>
              </>
            )}
          </div>

          {/* Nav items */}
          <nav className={cn("px-3 space-y-1 mt-4", collapsed && "px-2")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = window.location.pathname.startsWith(item.path);
              return (
                <Link key={item.path} href={item.path} className="block">
                  <div
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center rounded-xl font-semibold transition-all duration-200 cursor-pointer group",
                      collapsed ? "px-0 py-3 justify-center" : "px-4 py-3.5",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110 shrink-0", !collapsed && "mr-3")} />
                    {!collapsed && <span>{item.title}</span>}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom user section */}
        <div className={cn("p-4 border-t border-border/50 bg-muted/20", collapsed && "px-2")}>
          {!collapsed && (
            <div className="flex items-center mb-3">
              <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center mr-3 shrink-0">
                <UserCircle className="w-5 h-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{user.fullName || user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => logout()}
            title={collapsed ? "Log out" : undefined}
            className={cn(
              "w-full flex items-center rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors py-2.5",
              collapsed ? "justify-center px-0" : "justify-center px-4"
            )}
          >
            <LogOut className={cn("w-4 h-4 shrink-0", !collapsed && "mr-2")} />
            {!collapsed && "Log out"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
        <div className="p-8 md:p-12 max-w-7xl mx-auto">
          {children}
        </div>
        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          Powered by{' '}
          <a
            href="https://luma-website-six.vercel.app/#contact"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:underline transition-colors"
          >
            Vortex
          </a>
        </footer>
      </main>
      <OfflineBanner />
    </div>
  );
}
