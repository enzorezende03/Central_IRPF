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
  if (customMessage) {
    return customMessage
      .replace("[nome]", clientName)
      .replace("[link]", link);
  }
  return `Olá, ${clientName}. Para darmos andamento ao seu IRPF, envie seus documentos e responda as pendências neste link:\n${link}`;
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
