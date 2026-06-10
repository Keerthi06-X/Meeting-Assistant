import { Link, useLocation } from "wouter";
import { Mic, LayoutDashboard, UploadCloud, List, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGlobalMeetingNotifications } from "@/hooks/use-meeting-notifications";
import { useTheme } from "@/hooks/use-theme";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  useGlobalMeetingNotifications();
  const { theme, toggle } = useTheme();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/upload", label: "Upload Meeting", icon: UploadCloud },
    { href: "/meetings", label: "All Meetings", icon: List },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col hidden md:flex">
        <div className="p-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <Mic className="w-6 h-6" />
            <span>Smart Meeting</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            
            return (
              <Link key={link.href} href={link.href} className="block">
                <Button 
                  variant={isActive ? "secondary" : "ghost"} 
                  className={cn("w-full justify-start gap-3 transition-all", isActive ? "font-semibold bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
              JD
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Jane Doe</span>
              <span className="text-xs">jane@example.com</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background">
          <Link href="/" className="flex items-center gap-2 text-primary font-bold text-lg">
            <Mic className="w-5 h-5" />
            <span>Smart Meeting</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="h-8 w-8"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
