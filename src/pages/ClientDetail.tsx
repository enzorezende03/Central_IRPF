import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Copy, MessageCircle, Upload, CheckCircle, Circle, FileText, Clock, User, Mail, Phone, DollarSign } from "lucide-react";
import { InternalLayout } from "@/components/InternalLayout";
import { mockDemands, mockChecklist, mockQuestions, mockHistory, mockDocuments } from "@/lib/mock-data";
import { StatusBadge, BillingBadge, PriorityBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function ClientDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const demand = mockDemands.find(d => d.id === id);

  if (!demand) {
    return (
      <InternalLayout>
        <div className="p-6 text-center text-muted-foreground">Demanda não encontrada.</div>
      </InternalLayout>
    );
  }

  const client = demand.client!;
  const checklist = mockChecklist[demand.id] || [];
  const questions = mockQuestions[demand.id] || [];
  const history = mockHistory[demand.id] || [];
  const documents = mockDocuments[demand.id] || [];

  const portalLink = `${window.location.origin}/portal/${demand.access_token}`;
  const whatsappMsg = `Olá, ${client.name}. Para darmos andamento ao seu IRPF, envie seus documentos e responda as pendências neste link: ${portalLink}`;

  const checkedCount = checklist.filter(c => c.checked).length;
  const progress = checklist.length > 0 ? Math.round((checkedCount / checklist.length) * 100) : 0;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <InternalLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/clients">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{client.name}</h1>
            <p className="text-sm text-muted-foreground">CPF: {client.cpf} · Ano-base: {demand.year_base}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={demand.status} />
            <PriorityBadge priority={demand.priority} />
            <BillingBadge status={demand.billing_status} />
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="text-sm font-medium">{demand.responsible}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Celular</p>
                <p className="text-sm font-medium">{client.phone}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium truncate">{client.email}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Honorário</p>
                <p className="text-sm font-medium">{fmt(demand.fee_amount)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Progresso Geral</p>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{checkedCount} de {checklist.length} documentos recebidos</p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => copyToClipboard(portalLink, "Link do portal")}>
            <Copy className="h-4 w-4 mr-2" /> Copiar Link do Portal
          </Button>
          <Button variant="outline" onClick={() => copyToClipboard(whatsappMsg, "Mensagem WhatsApp")}>
            <MessageCircle className="h-4 w-4 mr-2" /> Copiar Mensagem WhatsApp
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="checklist" className="space-y-4">
          <TabsList>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="documents">Documentos ({documents.length})</TabsTrigger>
            <TabsTrigger value="questions">Perguntas ({questions.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="checklist">
            <Card>
              <CardHeader><CardTitle className="text-base">Checklist Documental</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    {item.checked ? (
                      <CheckCircle className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <span className={`text-sm ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader><CardTitle className="text-base">Documentos Enviados</CardTitle></CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento enviado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">Enviado em {doc.uploaded_at} · {doc.uploaded_by === 'client' ? 'Cliente' : 'Escritório'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader><CardTitle className="text-base">Questionário</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {questions.map(q => (
                  <div key={q.id} className="p-3 rounded-lg border space-y-2">
                    <p className="text-sm font-medium">{q.question_text}</p>
                    {q.answer_text ? (
                      <div className="flex items-start gap-2 bg-success/10 p-2 rounded-md">
                        <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        <p className="text-sm">{q.answer_text}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aguardando resposta do cliente</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de Interações</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="flex items-start gap-3 p-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{h.action}</p>
                        <p className="text-xs text-muted-foreground">{h.details} · {h.created_at}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader><CardTitle className="text-base">Observações Internas</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{demand.internal_notes || "Sem observações."}</p>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem visível ao cliente:</p>
                  <p className="text-sm">{demand.client_message || "Nenhuma mensagem definida."}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </InternalLayout>
  );
}
