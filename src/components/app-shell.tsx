import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ListChecks, Upload, Settings, LogOut, Leaf } from "lucide-react";

export function AppShell() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  const navItem = (to: string, label: string, icon: React.ReactNode) => (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      activeProps={{ className: "bg-accent text-foreground" }}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
              <Leaf className="size-5 text-primary" />
              <span>ESG 지표관리</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItem("/dashboard", "대시보드", <LayoutDashboard className="size-4" />)}
              {navItem("/indicators", "지표", <ListChecks className="size-4" />)}
              {navItem("/upload", "엑셀 업로드", <Upload className="size-4" />)}
              {isAdmin && navItem("/admin/indicators", "지표 마스터", <Settings className="size-4" />)}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4 mr-1" />
              로그아웃
            </Button>
          </div>
        </div>
        <nav className="md:hidden border-t flex overflow-x-auto px-2 py-1 gap-1">
          {navItem("/dashboard", "대시보드", <LayoutDashboard className="size-4" />)}
          {navItem("/indicators", "지표", <ListChecks className="size-4" />)}
          {navItem("/upload", "업로드", <Upload className="size-4" />)}
          {isAdmin && navItem("/admin/indicators", "마스터", <Settings className="size-4" />)}
        </nav>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
