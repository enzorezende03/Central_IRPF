import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/demandas": "Demandas IRPF",
  "/kanban": "Kanban Operacional",
  "/cobranca": "Cobrança",
  "/metas": "Metas IRPF",
  "/clientes": "Clientes",
  "/configuracoes": "Configurações",
};

export function InternalLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const baseRoute = "/" + (pathname.split("/")[1] || "");
  const pageTitle = PAGE_TITLES[baseRoute] ?? "Central IRPF 2026";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 shrink-0 shadow-sm">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">· Central IRPF 2026</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
