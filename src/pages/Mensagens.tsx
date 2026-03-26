import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InternalLayout } from "@/components/InternalLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Search, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface MessageThread {
  caseId: string;
  clientName: string;
  lastClientMessage: string;
  lastClientMessageAt: string;
  lastOfficeReplyAt: string | null;
  isReplied: boolean;
  unreadCount: number;
}

async function fetchMessageThreads(): Promise<MessageThread[]> {
  // Fetch all messages with case + client info
  const { data: cases, error: casesError } = await supabase
    .from("irpf_cases")
    .select("id, clients(full_name)");
  if (casesError) throw casesError;

  const { data: messages, error: msgsError } = await supabase
    .from("case_messages")
    .select("*")
    .order("created_at", { ascending: false });
  if (msgsError) throw msgsError;

  const caseMap = new Map<string, string>();
  for (const c of cases || []) {
    const client = c.clients as any;
    caseMap.set(c.id, client?.full_name || "Cliente");
  }

  // Group messages by case
  const grouped = new Map<string, typeof messages>();
  for (const msg of messages || []) {
    if (!grouped.has(msg.case_id)) grouped.set(msg.case_id, []);
    grouped.get(msg.case_id)!.push(msg);
  }

  const threads: MessageThread[] = [];

  for (const [caseId, msgs] of grouped) {
    const clientMsgs = msgs.filter((m) => m.sender === "client");
    if (clientMsgs.length === 0) continue; // only show cases with client messages

    const lastClientMsg = clientMsgs[0]; // already sorted desc
    const lastOfficeReply = msgs.find(
      (m) => m.sender === "office" && m.created_at > lastClientMsg.created_at
    );

    // Count client messages after last office reply
    const lastReplyTime = lastOfficeReply?.created_at || "1970-01-01";
    const unread = clientMsgs.filter((m) => m.created_at > lastReplyTime).length;

    threads.push({
      caseId,
      clientName: caseMap.get(caseId) || "Cliente",
      lastClientMessage: lastClientMsg.message,
      lastClientMessageAt: lastClientMsg.created_at,
      lastOfficeReplyAt: lastOfficeReply?.created_at || null,
      isReplied: !!lastOfficeReply,
      unreadCount: unread,
    });
  }

  // Sort: unreplied first, then by date desc
  threads.sort((a, b) => {
    if (a.isReplied !== b.isReplied) return a.isReplied ? 1 : -1;
    return new Date(b.lastClientMessageAt).getTime() - new Date(a.lastClientMessageAt).getTime();
  });

  return threads;
}

export default function Mensagens() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "replied">("all");
  const caseNamesRef = useRef<Map<string, string>>(new Map());

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["message-threads"],
    queryFn: fetchMessageThreads,
    refetchInterval: 30000,
  });

  // Keep a map of caseId -> clientName for realtime alerts
  useEffect(() => {
    for (const t of threads) {
      caseNamesRef.current.set(t.caseId, t.clientName);
    }
  }, [threads]);

  // Realtime subscription for new client messages
  useEffect(() => {
    const channel = supabase
      .channel("client-messages-alert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender === "client") {
            const clientName = caseNamesRef.current.get(msg.case_id) || "Cliente";
            const firstName = clientName.split(" ")[0];
            toast.info(`Nova mensagem de ${firstName}`, {
              description: msg.message?.substring(0, 80) + (msg.message?.length > 80 ? "..." : ""),
              action: {
                label: "Ver",
                onClick: () => navigate(`/demandas/${msg.case_id}`),
              },
              duration: 10000,
            });
            queryClient.invalidateQueries({ queryKey: ["message-threads"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, queryClient]);

  const filtered = useMemo(() => {
    let result = threads;
    if (filter === "pending") result = result.filter((t) => !t.isReplied);
    if (filter === "replied") result = result.filter((t) => t.isReplied);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.clientName.toLowerCase().includes(q) ||
          t.lastClientMessage.toLowerCase().includes(q)
      );
    }
    return result;
  }, [threads, filter, search]);

  const pendingCount = threads.filter((t) => !t.isReplied).length;

  return (
    <InternalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Central de Mensagens</h1>
              <p className="text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${pendingCount} mensagem(ns) aguardando resposta`
                  : "Todas as mensagens respondidas"}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou mensagem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5">
                Todas
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{threads.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                Pendentes
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="replied" className="gap-1.5">
                Respondidas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Message list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 h-20" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Nenhuma mensagem encontrada</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {filter === "pending"
                  ? "Todas as mensagens foram respondidas!"
                  : "Nenhum cliente enviou mensagens ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((thread) => (
              <Card
                key={thread.caseId}
                className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                  !thread.isReplied ? "border-l-4 border-l-destructive" : ""
                }`}
                onClick={() => navigate(`/demandas/${thread.caseId}`)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  {/* Status icon */}
                  <div
                    className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      !thread.isReplied
                        ? "bg-destructive/10 text-destructive"
                        : "bg-emerald-500/10 text-emerald-600"
                    }`}
                  >
                    {!thread.isReplied ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {thread.clientName}
                      </span>
                      {!thread.isReplied && thread.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {thread.unreadCount} nova{thread.unreadCount > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {thread.lastClientMessage}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(thread.lastClientMessageAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </div>
                    <Badge
                      variant={thread.isReplied ? "secondary" : "outline"}
                      className="mt-1.5 text-[10px]"
                    >
                      {thread.isReplied ? "Respondida" : "Aguardando"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </InternalLayout>
  );
}
