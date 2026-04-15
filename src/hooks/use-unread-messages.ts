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
    queryFn: async () => {
      // Get all messages from clients
      const { data: messages } = await supabase
        .from("case_messages")
        .select("id, case_id, message, created_at, sender")
        .order("created_at", { ascending: false });

      if (!messages || messages.length === 0) return [];

      // Group by case_id – a conversation is "unread" if the last message is from client
      const caseMap = new Map<string, typeof messages>();
      for (const msg of messages) {
        if (!caseMap.has(msg.case_id)) caseMap.set(msg.case_id, []);
        caseMap.get(msg.case_id)!.push(msg);
      }

      const unreadCaseIds: string[] = [];
      const caseUnreads = new Map<string, { count: number; lastMsg: typeof messages[0] }>();

      for (const [caseId, msgs] of caseMap) {
        // msgs are already sorted desc by created_at
        if (msgs[0].sender === "client") {
          // Count consecutive client messages from the top
          let count = 0;
          for (const m of msgs) {
            if (m.sender === "client") count++;
            else break;
          }
          unreadCaseIds.push(caseId);
          caseUnreads.set(caseId, { count, lastMsg: msgs[0] });
        }
      }

      if (unreadCaseIds.length === 0) return [];

      // Fetch client names
      const { data: cases } = await supabase
        .from("irpf_cases")
        .select("id, clients(full_name)")
        .in("id", unreadCaseIds);

      const result: UnreadConversation[] = [];
      for (const c of cases ?? []) {
        const info = caseUnreads.get(c.id);
        if (!info) continue;
        result.push({
          case_id: c.id,
          client_name: (c.clients as any)?.full_name ?? "Cliente",
          last_message: info.lastMsg.message,
          last_message_at: info.lastMsg.created_at,
          unread_count: info.count,
        });
      }

      // Sort by oldest unanswered first
      result.sort((a, b) => new Date(a.last_message_at).getTime() - new Date(b.last_message_at).getTime());
      return result;
    },
    refetchInterval: 30000,
  });
}
