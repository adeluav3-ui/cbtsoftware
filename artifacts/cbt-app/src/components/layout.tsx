import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { Building, LayoutDashboard, BookOpen, PenTool, LogOut, Loader2, UserCircle, ChevronLeft, ChevronRight, Menu, X, Upload, Camera } from "lucide-react";
import { cn } from "./ui-elements";
import { supabase } from "@/lib/supabase";

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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-destructive text-white px-4 py-2 rounded-xl shadow-lg font-semibold text-xs z-50 whitespace-nowrap">
      You are offline — some features may be unavailable
    </div>
  );
}

export function DashboardLayout({ children, allowedRoles }: { children: ReactNode, allowedRoles: string[] }) {
  const { user, isLoading, refetch, setUser } = useAuth();
  const [, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(user?.profilePicture || null);

  const { mutate: logout } = useLogout({
    mutation: {
      onSuccess: () => {
        setUser(null);
        refetch();
        setLocation("/login");
      }
    }
  });

  // Update profile picture when user changes
  useEffect(() => {
    if (user?.profilePicture) {
      setProfilePicture(user.profilePicture);
    }
  }, [user]);

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

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileMenuOpen]);

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPicture(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/teachers/profile-picture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePictureUrl: publicUrl }),
        credentials: "include",
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setProfilePicture(updatedUser.profilePicture);
        if (user) {
          setUser({ ...user, profilePicture: updatedUser.profilePicture });
        }
        await refetch();
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload profile picture. Please try again.");
    } finally {
      setUploadingPicture(false);
    }
  };

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

  // Sidebar content component (reused for both desktop and mobile)
  const SidebarContent = () => (
    <>
      <div>
        {/* Logo area */}
        <div className={cn("p-4 pb-3 transition-all duration-300", collapsed && "px-2 flex justify-center")}>
          {collapsed ? (
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
          ) : (
            <>
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold font-display text-primary">CBT Portal</h1>
              <p className="text-xs md:text-sm font-medium text-muted-foreground mt-1 truncate">
                {user.schoolName || "Global Administration"}
              </p>
            </>
          )}
        </div>

        {/* Nav items */}
        <nav className={cn("px-2 space-y-1 mt-3", collapsed && "px-1")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = window.location.pathname === item.path || window.location.pathname.startsWith(item.path + '/');
            return (
              <Link key={item.path} href={item.path} onClick={() => setMobileMenuOpen(false)}>
                <div
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center rounded-xl font-semibold transition-all duration-200 cursor-pointer",
                    collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5 md:px-4 md:py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Icon className={cn("w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:scale-110 shrink-0", !collapsed && "mr-2 md:mr-3")} />
                  {!collapsed && <span className="text-sm md:text-base">{item.title}</span>}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom user section with profile picture */}
      <div className={cn("p-3 border-t border-border/50 bg-muted/20", collapsed && "px-2")}>
        {!collapsed && (
          <div className="flex items-center mb-3">
            {/* Profile Picture */}
            <div className="relative group shrink-0 mr-2 md:mr-3">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={user.fullName || user.username}
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-secondary/20 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 md:w-5 md:h-5 text-secondary" />
                </div>
              )}
              {/* Upload button overlay on hover */}
              <label className="absolute -bottom-1 -right-1 cursor-pointer bg-primary rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-3 h-3 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  disabled={uploadingPicture}
                  className="hidden"
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs md:text-sm truncate">{user.fullName || user.username}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="relative group flex justify-center mb-3">
            {profilePicture ? (
              <img
                src={profilePicture}
                alt={user.fullName || user.username}
                className="w-8 h-8 rounded-full object-cover border-2 border-primary/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
                <UserCircle className="w-4 h-4 text-secondary" />
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 cursor-pointer bg-primary rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-2.5 h-2.5 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                disabled={uploadingPicture}
                className="hidden"
              />
            </label>
          </div>
        )}
        <button
          onClick={() => logout()}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "w-full flex items-center rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors py-2",
            collapsed ? "justify-center px-0" : "justify-center px-3"
          )}
        >
          <LogOut className={cn("w-3 h-3 md:w-4 md:h-4 shrink-0", !collapsed && "mr-2")} />
          {!collapsed && "Log out"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-card border border-border shadow-md"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar (always visible) */}
      <aside
        className={cn(
          "hidden md:flex bg-card border-r border-border flex-col justify-between shadow-2xl shadow-black/5 z-20 transition-all duration-300 ease-in-out relative",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3.5 top-8 w-7 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors z-30"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (slides in) */}
      <aside
        className={cn(
          "fixed md:hidden top-0 left-0 h-full w-72 bg-card border-r border-border flex flex-col justify-between shadow-2xl z-50 transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10 transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-32 md:h-48 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none -z-10" />
        <div className="p-3 pt-14 md:p-6 md:pt-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground pb-4">
          Powered by{' '}
          <a
            href="https://luma-website-six.vercel.app/"
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