import { Link, useLocation } from "wouter";
import { Mic, LayoutDashboard, UploadCloud, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useGlobalMeetingNotifications } from "@/hooks/use-meeting-notifications";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  useGlobalMeetingNotifications();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/upload", label: "Upload Meeting", icon: UploadCloud },
    { href: "/meetings", label: "All Meetings", icon: List },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col hidden md:flex shrink-0"
        style={{ background: "linear-gradient(160deg, #4338ca 0%, #7c3aed 60%, #a855f7 100%)" }}
      >
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <Mic className="w-6 h-6" />
            <span>Smart Meeting</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));

            return (
              <Link key={link.href} href={link.href} className="block">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 transition-all text-white/80 hover:text-white hover:bg-white/10",
                    isActive && "bg-white/20 text-white font-semibold shadow-sm"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/20">
          <div className="flex items-center gap-3 px-2 py-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-xs shrink-0">
              JD
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-white truncate">Jane Doe</span>
              <span className="text-xs text-white/60 truncate">jane@example.com</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header
          className="md:hidden flex items-center justify-between p-4 border-b"
          style={{ background: "linear-gradient(90deg, #4338ca 0%, #7c3aed 100%)" }}
        >
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-white">
            <Mic className="w-5 h-5" />
            <span>Smart Meeting</span>
          </Link>
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
