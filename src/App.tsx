import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import ClientDetail from "./pages/ClientDetail";
import KanbanPage from "./pages/KanbanPage";
import Cobranca from "./pages/Cobranca";
import MetasIRPF from "./pages/MetasIRPF";
import Clientes from "./pages/Clientes";
import Configuracoes from "./pages/Configuracoes";
import Mensagens from "./pages/Mensagens";
import ClientPortal from "./pages/ClientPortal";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/portal/:org/:slug" element={<ClientPortal />} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/demandas" element={<ProtectedRoute><Demandas /></ProtectedRoute>} />
            <Route path="/demandas/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="/kanban" element={<ProtectedRoute><KanbanPage /></ProtectedRoute>} />
            <Route path="/cobranca" element={<ProtectedRoute><Cobranca /></ProtectedRoute>} />
            <Route path="/metas" element={<ProtectedRoute><MetasIRPF /></ProtectedRoute>} />
            <Route path="/mensagens" element={<ProtectedRoute><Mensagens /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
