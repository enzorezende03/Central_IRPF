import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import ClientDetail from "./pages/ClientDetail";
import KanbanPage from "./pages/KanbanPage";
import Cobranca from "./pages/Cobranca";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import ClientPortal from "./pages/ClientPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/demandas" element={<Demandas />} />
          <Route path="/demandas/:id" element={<ClientDetail />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/cobranca" element={<Cobranca />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/portal/:token" element={<ClientPortal />} />
          {/* Legacy redirects */}
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
