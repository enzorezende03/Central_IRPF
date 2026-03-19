import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Copy, MessageCircle, ExternalLink, MoreHorizontal, CreditCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { CaseWithClient } from "@/hooks/use-cases";
import { STATUS_LABELS } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type CaseStatus = Database["public"]["Enums"]["case_status"];

function getPortalUrl(token: string) {
  return `${window.location.origin}/portal/${token}`;
}

function getWhatsAppMessage(name: string, token: string) {
  const link = getPortalUrl(token);
  return `Olá, ${name}. Para darmos andamento ao seu IRPF, envie seus documentos e responda as pendências neste link: ${link}`;
}

export function CaseActions({ caseData }: { caseData: CaseWithClient }) {
  const queryClient = useQueryClient();
  const clientName = caseData.clients?.full_name ?? "Cliente";

  const copyLink = () => {
    navigator.clipboard.writeText(getPortalUrl(caseData.portal_token));
    toast.success("Link copiado!");
  };

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(getWhatsAppMessage(clientName, caseData.portal_token));
    toast.success("Mensagem WhatsApp copiada!");
  };

  const openPortal = () => {
    window.open(getPortalUrl(caseData.portal_token), "_blank");
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
      queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    }
  };

  const statuses: CaseStatus[] = [
    "aguardando_cliente",
    "documentos_em_analise",
    "em_andamento",
    "pendencia",
    "finalizado",
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link to={`/clients/${caseData.id}`} className="cursor-pointer">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
