import { useParams } from "react-router-dom";
import { FileText, Upload, CheckCircle, Circle, AlertTriangle, Download, MessageSquare, Send } from "lucide-react";
import { mockDemands, mockChecklist, mockQuestions, mockDocuments } from "@/lib/mock-data";
import { STATUS_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useState } from "react";

export default function ClientPortal() {
  const { token } = useParams();
  const demand = mockDemands.find(d => d.access_token === token);

  if (!demand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Link inválido</h1>
            <p className="text-sm text-muted-foreground">Este link não é válido ou expirou. Entre em contato com seu escritório de contabilidade.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const client = demand.client!;
  const checklist = mockChecklist[demand.id] || [];
  const questions = mockQuestions[demand.id] || [];
  const documents = mockDocuments[demand.id] || [];
  const pendingDocs = checklist.filter(c => !c.checked);
  const isFinished = demand.status === 'finalizado';

  const statusSteps = [
    { key: 'aguardando_cliente', label: 'Aguardando Documentos' },
    { key: 'documentos_em_analise', label: 'Documentos em Análise' },
    { key: 'em_andamento', label: 'Em Andamento' },
    { key: 'finalizado', label: 'Finalizado' },
  ];
  const currentStepIndex = statusSteps.findIndex(s => s.key === demand.status);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold">Central IRPF 2026</h1>
            <p className="text-xs text-muted-foreground">Portal do Cliente</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6 pb-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-6">
              <p className="text-lg font-semibold mb-1">Olá, {client.name}!</p>
              {demand.client_message && (
                <div className="mt-3 p-3 rounded-lg bg-accent border border-primary/20">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{demand.client_message}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Steps */}
        <Card>
          <CardHeader><CardTitle className="text-base">Andamento do IRPF</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {statusSteps.map((step, i) => {
                const isActive = i <= currentStepIndex && demand.status !== 'pendencia';
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.key} className="flex-1">
                    <div className={`h-2 rounded-full ${isActive ? 'bg-primary' : 'bg-muted'}`} />
                    <p className={`text-[10px] mt-1 text-center ${isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {demand.status === 'pendencia' && (
              <div className="mt-3 flex items-center gap-2 text-destructive bg-destructive/10 p-2 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-medium">Existem pendências que precisam da sua atenção.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Documents */}
        {pendingDocs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Documentos Pendentes ({pendingDocs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border border-warning/30 bg-warning/5">
                  <Circle className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm flex-1">{doc.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        <Card>
          <CardHeader><CardTitle className="text-base">Enviar Documentos</CardTitle></CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Clique para enviar documentos</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG até 10MB</p>
            </div>
            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Documentos já enviados:</p>
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-success shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Questions */}
        {questions.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Perguntas do Escritório</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {questions.map(q => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">{q.question_text}</p>
                  {q.answer_text ? (
                    <div className="flex items-start gap-2 bg-success/10 p-2 rounded-md">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <p className="text-sm">{q.answer_text}</p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Textarea placeholder="Digite sua resposta..." className="text-sm" />
                      <Button size="icon" className="shrink-0 self-end"><Send className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Final Declaration */}
        {isFinished && (
          <Card className="border-success/30">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-10 w-10 text-success mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-1">Declaração Finalizada!</h2>
              <p className="text-sm text-muted-foreground mb-4">Sua declaração de IRPF foi concluída com sucesso.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button>
                  <Download className="h-4 w-4 mr-2" /> Baixar Declaração
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Baixar Recibo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
