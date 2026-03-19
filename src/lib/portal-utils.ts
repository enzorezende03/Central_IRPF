import { supabase } from "@/integrations/supabase/client";

export function getPortalUrl(token: string) {
  return `${window.location.origin}/portal/${token}`;
}

export function getWhatsAppMessage(clientName: string, token: string, customMessage?: string | null) {
  const link = getPortalUrl(token);
  if (customMessage) {
    // Replace placeholders in custom message
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
