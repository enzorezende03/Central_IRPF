import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UnreadConversation {
  case_id: string;
  client_name: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export function useUnreadMessages() {
  return useQuery({
    queryKey: ["unread-messages"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Only fetch unread client messages — much lighter than scanning every message.
      const { data: unread } = await supabase
        .from("case_messages")
        .select("id, case_id, message, created_at")
        .eq("sender", "client")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!unread || unread.length === 0) return [];

      const byCase = new Map<string, { count: number; lastMsg: typeof unread[0] }>();
      for (const m of unread) {
        const cur = byCase.get(m.case_id);
        if (!cur) byCase.set(m.case_id, { count: 1, lastMsg: m });
        else {
          cur.count++;
          if (m.created_at > cur.lastMsg.created_at) cur.lastMsg = m;
        }
      }

      const caseIds = Array.from(byCase.keys());

      // Discard threads where the office already replied AFTER the latest unread
      // client message — they're effectively answered, just not flagged read.
      const { data: officeReplies } = await supabase
        .from("case_messages")
        .select("case_id, created_at")
        .eq("sender", "office")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false });

      const lastOfficeByCase = new Map<string, string>();
      for (const r of officeReplies ?? []) {
        if (!lastOfficeByCase.has(r.case_id)) lastOfficeByCase.set(r.case_id, r.created_at);
      }
      for (const [caseId, info] of byCase) {
        const lastReply = lastOfficeByCase.get(caseId);
        if (lastReply && lastReply > info.lastMsg.created_at) byCase.delete(caseId);
      }

      const filteredCaseIds = Array.from(byCase.keys());
      if (filteredCaseIds.length === 0) return [];

      const { data: cases } = await supabase
        .from("irpf_cases")
        .select("id, clients(full_name)")
        .in("id", filteredCaseIds);

      const result: UnreadConversation[] = [];
      for (const c of cases ?? []) {
        const info = byCase.get(c.id);
        if (!info) continue;
        result.push({
          case_id: c.id,
          client_name: (c.clients as any)?.full_name ?? "Cliente",
          last_message: info.lastMsg.message,
          last_message_at: info.lastMsg.created_at,
          unread_count: info.count,
        });
      }

      result.sort((a, b) => new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime());
      return result;
    },
  });
}
