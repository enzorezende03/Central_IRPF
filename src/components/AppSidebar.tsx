import {
  LayoutDashboard, FileText, Kanban, DollarSign, Users, Settings, LogOut, MessageCircle,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useOfficeLogo } from "@/hooks/use-office-logo";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUnreadMessages } from "@/hooks/use-unread-messages";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, permission: null },
  { title: "Demandas IRPF", url: "/demandas", icon: FileText, permission: "acesso_demandas" },
  { title: "Kanban Operacional", url: "/kanban", icon: Kanban, permission: "acesso_demandas" },
  { title: "Mensagens", url: "/mensagens", icon: MessageCircle, permission: "acesso_demandas" },
  { title: "Cobrança", url: "/cobranca", icon: DollarSign, permission: "acesso_cobranca" },
  { title: "Clientes", url: "/clientes", icon: Users, permission: "acesso_demandas" },
  { title: "Configurações", url: "/configuracoes", icon: Settings, permission: "acesso_configuracao" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, role, profileName, signOut, hasPermission } = useAuth();
  const navigate = useNavigate();
  const logoUrl = useOfficeLogo();
  const { data: unreadMessages = [] } = useUnreadMessages();
  const unreadCount = unreadMessages.length;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const roleLabel = role === "admin" ? "Administrador" : role === "operacional" ? "Operacional" : role === "financeiro" ? "Financeiro" : "Usuário";

  const visibleItems = menuItems.filter((item) =>
    item.permission === null || hasPermission(item.permission)
  );

  return (
    <TooltipProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <img src={logoUrl} alt="Logo do Escritório" className="h-12 w-12 rounded-lg object-contain" />
            <div>
              <h1 className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">Central IRPF</h1>
              <p className="text-[10px] text-sidebar-foreground/50 font-medium">Exercício 2026</p>
            </div>
          </div>
        ) : (
          <img src={logoUrl} alt="Logo do Escritório" className="h-10 w-10 rounded-lg object-contain mx-auto" />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.title}
                          {item.title === "Mensagens" && unreadCount > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center">
                                  {unreadCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[220px]">
                                <p className="font-semibold text-xs mb-1">Mensagens pendentes:</p>
                                <ul className="text-xs space-y-0.5">
                                  {unreadMessages.slice(0, 5).map((m) => (
                                    <li key={m.case_id} className="truncate">• {m.client_name} ({m.unread_count})</li>
                                  ))}
                                  {unreadMessages.length > 5 && (
                                    <li className="text-muted-foreground">e mais {unreadMessages.length - 5}...</li>
                                  )}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      )}
                      {collapsed && item.title === "Mensagens" && unreadCount > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center px-1">
                              {unreadCount}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[220px]">
                            <p className="font-semibold text-xs mb-1">Mensagens pendentes:</p>
                            <ul className="text-xs space-y-0.5">
                              {unreadMessages.slice(0, 5).map((m) => (
                                <li key={m.case_id} className="truncate">• {m.client_name} ({m.unread_count})</li>
                              ))}
                              {unreadMessages.length > 5 && (
                                <li className="text-muted-foreground">e mais {unreadMessages.length - 5}...</li>
                              )}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-sidebar-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-sidebar-foreground truncate">
                  {profileName || user?.user_metadata?.full_name || user?.email || "Usuário"}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50">Perfil: {roleLabel}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="mx-auto text-sidebar-foreground/60 hover:text-sidebar-foreground"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
    </TooltipProvider>
  );
}
