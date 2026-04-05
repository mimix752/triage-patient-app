import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  ClipboardPlus,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Accueil service", path: "/" },
  { icon: ClipboardPlus, label: "Admission patient", path: "/nouveau-dossier" },
  { icon: Activity, label: "Salle d’attente", path: "/tableau-de-bord" },
  { icon: ShieldAlert, label: "Protocoles", path: "/protocoles" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(28,124,84,0.12),_transparent_35%),linear-gradient(180deg,_rgba(248,250,252,1)_0%,_rgba(239,246,255,0.92)_100%)] px-4">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <Badge className="mb-4 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
            Espace clinique sécurisé
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Accès réservé au personnel soignant
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Connectez-vous pour accéder à l’admission patient, à la salle d’attente et au suivi opérationnel du service.
          </p>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="mt-8 h-12 w-full rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"
          >
            Ouvrir l’espace personnel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0 bg-transparent" disableTransition={isResizing}>
          <SidebarHeader className="h-auto justify-center border-b border-sidebar-border/70 px-3 py-4">
            <div className="flex w-full items-start gap-3 px-1 transition-all">
              <button
                onClick={toggleSidebar}
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl hover:bg-sidebar-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Basculer la navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">
                      Urgences
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-white/60 bg-white/70 text-[11px]">
                      Sécurisé
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                      Triage clinique
                    </p>
                    <p className="mt-1 text-xs leading-5 text-sidebar-foreground/65">
                      Admission, salle d’attente et suivi opérationnel du service.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            <div className="rounded-[1.6rem] border border-white/60 bg-white/70 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <SidebarMenu className="gap-1 px-1 py-1">
                {menuItems.map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-11 rounded-2xl px-3 text-sm font-medium transition-all"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-sidebar-foreground/70"}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>

            {!isCollapsed ? (
              <div className="mt-4 rounded-[1.6rem] border border-emerald-200/70 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(240,249,255,0.90))] p-4 shadow-[0_20px_50px_rgba(16,185,129,0.10)]">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">Aide à la priorisation</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-emerald-900/75">
                  Les recommandations servent d’appui au tri. La décision finale reste sous la responsabilité de l’équipe soignante.
                </p>
              </div>
            ) : null}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/80 px-2 py-2 text-left shadow-sm transition-colors hover:bg-white group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-10 w-10 shrink-0 border border-slate-200">
                    <AvatarFallback className="bg-slate-900 text-xs font-semibold text-white">
                      {user?.name?.charAt(0).toUpperCase() || "M"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium leading-none text-slate-900">
                      {user?.name || "Personnel médical"}
                    </p>
                    <p className="mt-1.5 truncate text-xs text-slate-500">{user?.email || "Session protégée"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Se déconnecter</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-transparent">
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/60 bg-background/90 px-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-xl bg-white/80 shadow-sm" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold tracking-tight text-foreground">
                  {activeMenuItem?.label ?? "Triage"}
                </span>
                  <span className="text-[11px] text-muted-foreground">Usage clinique mobile</span>

              </div>
            </div>
          </div>
        )}
        <main className="min-h-screen flex-1 p-3 sm:p-5 lg:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
