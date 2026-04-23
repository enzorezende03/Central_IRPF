import { supabase } from "@/integrations/supabase/client";

export function generateSlug(clientName: string): string {
  const base = clientName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `grupo2m/${base}-${suffix}`;
}

export function getPortalUrl(slugOrToken: string) {
  return `${window.location.origin}/portal/${slugOrToken}`;
}

export function getWhatsAppMessage(clientName: string, slugOrToken: string, customMessage?: string | null) {
  const link = getPortalUrl(slugOrToken);
  const firstName = clientName.split(" ")[0];
  if (customMessage) {
    return customMessage
      .replace("[nome]", firstName)
      .replace("[link]", link);
  }
  return `Olá ${firstName}. Tudo bem?\n\nPara darmos andamento ao seu Imposto de Renda, pedimos que envie seus documentos e responda as pendências pelo link abaixo: ${link}.\n\nNeste portal você também pode acompanhar o status da sua declaração e, se precisar, nos enviar dúvidas por mensagem.`;
}

export function getPendingDocsMessage(
  clientName: string,
  slugOrToken: string,
  pendingDocs: { title: string; status?: string | null }[],
) {
  const link = getPortalUrl(slugOrToken);
  const firstName = clientName.split(" ")[0];
  if (!pendingDocs.length) {
    return `Olá ${firstName}, tudo bem?\n\nTudo certo com sua documentação por aqui! Assim que tivermos novidades, avisaremos pelo portal: ${link}`;
  }
  const lines = pendingDocs
    .map((d) => {
      const isRejected = d.status === "rejeitado";
      return `• ${d.title}${isRejected ? " (precisa ser reenviado)" : ""}`;
    })
    .join("\n");
  return `Olá ${firstName}, tudo bem?\n\nEstamos finalizando seu Imposto de Renda, mas ainda faltam alguns documentos para darmos continuidade:\n\n${lines}\n\nVocê pode enviá-los diretamente pelo seu portal:\n${link}\n\nQualquer dúvida, é só responder esta mensagem. Obrigado!`;
}

export async function logTimelineEvent(
  caseId: string,
  eventType: string,
  description?: string,
  visibleToClient = false,
) {
  await supabase.from("case_timeline").insert({
    case_id: caseId,
    event_type: eventType,
    description: description ?? null,
    visible_to_client: visibleToClient,
    created_by: "Escritório",
  });
}
