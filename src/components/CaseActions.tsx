import { Link } from "react-router-dom";
import { Eye, Copy, MessageCircle, ExternalLink, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { getPortalUrl, getWhatsAppMessage, logTimelineEvent } from "@/lib/portal-utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

export function CaseActions({ caseData }: { caseData: CaseWithClient }) {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const clientName = caseData.clients?.full_name ?? "Cliente";

  const linkId = caseData.portal_slug || caseData.portal_token;
  const copyLink = async () => {
    navigator.clipboard.writeText(getPortalUrl(linkId));
    toast.success("Link copiado!");
    await logTimelineEvent(caseData.id, "Link copiado", `Link do portal copiado para ${clientName}`);
    queryClient.invalidateQueries({ queryKey: ["case-timeline", caseData.id] });
  };

  const copyWhatsApp = async () => {
    const msg = getWhatsAppMessage(clientName, linkId, caseData.client_message);
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem WhatsApp copiada!");
    await logTimelineEvent(caseData.id, "WhatsApp copiado", `Mensagem WhatsApp copiada para ${clientName}`, true);
    queryClient.invalidateQueries({ queryKey: ["case-timeline", caseData.id] });
  };

  const openPortal = async () => {
    window.open(getPortalUrl(linkId), "_blank");
    await logTimelineEvent(caseData.id, "Portal aberto", `Portal aberto pelo escritório`);
    queryClient.invalidateQueries({ queryKey: ["case-timeline", caseData.id] });
  };

  const changeStatus = async (newStatus: CaseStatus) => {
    const { error } = await supabase
      .from("irpf_cases")
      .update({ status: newStatus })
      .eq("id", caseData.id);
    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(`Status alterado para ${STATUS_LABELS[newStatus]}`);
      await logTimelineEvent(
        caseData.id,
        "Status alterado",
        `Status alterado para ${STATUS_LABELS[newStatus]}`,
        true,
      );
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from("irpf_cases")
      .delete()
      .eq("id", caseData.id);
    if (error) {
      toast.error("Erro ao excluir demanda");
    } else {
      toast.success("Demanda excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    }
    setConfirmDelete(false);
  };

  const statuses: CaseStatus[] = [
    "aguardando_cliente",
    "documentos_em_analise",
    "em_andamento",
    "pendencia",
    "finalizado",
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link to={`/demandas/${caseData.id}`} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" />
              Ver detalhes
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar link do portal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyWhatsApp}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Copiar mensagem WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openPortal}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir portal do cliente
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {statuses
            .filter((s) => s !== caseData.status)
            .map((s) => (
              <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir demanda
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a demanda de <strong>{clientName}</strong>? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
