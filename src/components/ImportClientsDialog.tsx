import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REQUIRED_DOCUMENTS } from "@/lib/types";
import { logTimelineEvent } from "@/lib/portal-utils";
import * as XLSX from "xlsx";

interface ParsedClient {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  responsavel: string;
  tipo_cobranca: string;
  valor_honorario: number;
  valid: boolean;
  error?: string;
}

function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .trim();
}

function mapRow(row: Record<string, any>): ParsedClient {
  const normalized: Record<string, any> = {};
  Object.entries(row).forEach(([k, v]) => {
    normalized[normalizeHeader(String(k))] = v;
  });

  const full_name = String(
    normalized.nome_completo ?? normalized.nome ?? normalized.full_name ?? normalized.cliente ?? ""
  ).trim();

  const cpf = String(
    normalized.cpf ?? normalized.cpf_cnpj ?? ""
  ).trim();

  const email = String(
    normalized.email ?? normalized.e_mail ?? ""
  ).trim();

  const phone = String(
    normalized.telefone ?? normalized.phone ?? normalized.celular ?? normalized.whatsapp ?? ""
  ).trim();

  const responsavel = String(
    normalized.responsavel ?? normalized.responsible ?? normalized.operador ?? ""
  ).trim();

  const tipoRaw = String(
    normalized.tipo_cobranca ?? normalized.tipo ?? normalized.cobranca ?? ""
  ).trim().toLowerCase();

  const tipo_cobranca = tipoRaw.includes("inclus") || tipoRaw.includes("mensal")
    ? "incluso_mensalidade"
    : "cobranca_extra";

  const valorRaw = normalized.valor ?? normalized.honorario ?? normalized.valor_honorario ?? 0;
  const valor_honorario = typeof valorRaw === "number"
    ? valorRaw
    : parseFloat(String(valorRaw).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;

  const errors: string[] = [];
  if (!full_name) errors.push("Nome obrigatório");
  if (!cpf) errors.push("CPF obrigatório");

  return {
    full_name,
    cpf,
    email,
    phone,
    responsavel,
    tipo_cobranca,
    valor_honorario,
    valid: errors.length === 0,
    error: errors.length ? errors.join("; ") : undefined,
  };
}

export function ImportClientsDialog() {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (rows.length === 0) {
          toast.error("A planilha está vazia.");
          return;
        }

        const clients = rows.map(mapRow);
        setParsed(clients);
        setResults(null);
        setProgress(0);
      } catch {
        toast.error("Erro ao ler a planilha. Verifique o formato do arquivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    const validClients = parsed.filter((c) => c.valid);
    if (validClients.length === 0) {
      toast.error("Nenhum cliente válido para importar.");
      return;
    }

    setImporting(true);
    setProgress(0);
    let success = 0;
    let errors = 0;
    const baseYear = new Date().getFullYear() - 1;

    for (let i = 0; i < validClients.length; i++) {
      const c = validClients[i];
      try {
        // Create client
        const { data: client, error: clientErr } = await supabase
          .from("clients")
          .insert({
            full_name: c.full_name,
            cpf: c.cpf,
            email: c.email || null,
            phone: c.phone || null,
            billing_type: c.tipo_cobranca,
          })
          .select("id")
          .single();

        if (clientErr) throw clientErr;

        // Create IRPF case
        const token = generateToken();
        const { data: newCase, error: caseErr } = await supabase
          .from("irpf_cases")
          .insert({
            client_id: client.id,
            base_year: baseYear,
            tax_year: baseYear + 1,
            internal_owner: c.responsavel || null,
            priority: "media" as any,
            portal_token: token,
            status: "aguardando_cliente" as any,
            progress_percent: 0,
          })
          .select("id")
          .single();

        if (caseErr) throw caseErr;

        // Create default document requests
        const docInserts = REQUIRED_DOCUMENTS.map((title, idx) => ({
          case_id: newCase.id,
          title,
          is_required: idx < 3,
          status: "pendente" as const,
        }));
        await supabase.from("document_requests").insert(docInserts);

        // Create billing record
        await supabase.from("billing").insert({
          case_id: newCase.id,
          amount: c.valor_honorario,
          billing_status: c.tipo_cobranca === "incluso_mensalidade" ? "pago" : "nao_cobrado",
          billing_type: c.tipo_cobranca,
        } as any);

        // Log timeline
        await logTimelineEvent(newCase.id, "criacao", "Demanda criada via importação de planilha.");

        success++;
      } catch (err: any) {
        console.error(`Erro ao importar ${c.full_name}:`, err);
        errors++;
      }

      setProgress(Math.round(((i + 1) / validClients.length) * 100));
    }

    setImporting(false);
    setResults({ success, errors });
    queryClient.invalidateQueries({ queryKey: ["irpf-cases"] });
    queryClient.invalidateQueries({ queryKey: ["all-clients"] });

    if (errors === 0) {
      toast.success(`${success} cliente(s) importado(s) com sucesso!`);
    } else {
      toast.warning(`${success} importado(s), ${errors} erro(s).`);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      {
        "Nome Completo": "Maria da Silva",
        "CPF": "000.000.000-00",
        "E-mail": "maria@email.com",
        "Telefone": "(11) 99999-0000",
        "Responsável": "Ana",
        "Tipo Cobrança": "Cobrança extra",
        "Valor Honorário": 1500,
      },
      {
        "Nome Completo": "João Santos",
        "CPF": "111.111.111-11",
        "E-mail": "joao@email.com",
        "Telefone": "(11) 98888-0000",
        "Responsável": "Carlos",
        "Tipo Cobrança": "Incluso na mensalidade",
        "Valor Honorário": 0,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 25 }, { wch: 16 }, { wch: 25 }, { wch: 18 },
      { wch: 15 }, { wch: 22 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "modelo_importacao_clientes.xlsx");
  };

  const validCount = parsed.filter((c) => c.valid).length;
  const invalidCount = parsed.filter((c) => !c.valid).length;

  const resetState = () => {
    setParsed([]);
    setResults(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-1.5" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Clientes via Planilha
          </DialogTitle>
          <DialogDescription>
            Importe clientes de um arquivo Excel (.xlsx). Uma demanda IRPF será criada automaticamente para cada cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Upload area */}
          {parsed.length === 0 && !results && (
            <div className="space-y-3">
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Clique para selecionar arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="w-full text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Baixar modelo de planilha
              </Button>
            </div>
          )}

          {/* Preview */}
          {parsed.length > 0 && !results && (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-xs">{validCount} válido(s)</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{invalidCount} com erro</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{parsed.length} linha(s) encontrada(s)</span>
              </div>

              <ScrollArea className="flex-1 max-h-[320px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                      <TableHead className="hidden sm:table-cell">Cobrança</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((c, i) => (
                      <TableRow key={i} className={!c.valid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{c.full_name || "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{c.cpf || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c.responsavel || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">
                          {c.tipo_cobranca === "incluso_mensalidade" ? "Incluso" : `Extra R$ ${c.valor_honorario}`}
                        </TableCell>
                        <TableCell>
                          {c.valid ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <span className="text-xs text-destructive" title={c.error}>
                              <AlertCircle className="h-4 w-4" />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Importando... {progress}%
                  </p>
                </div>
              )}
            </>
          )}

          {/* Results */}
          {results && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="h-10 w-10 text-success mx-auto" />
              <div>
                <p className="font-medium">Importação concluída</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.success} cliente(s) e demanda(s) criado(s)
                  {results.errors > 0 && `, ${results.errors} erro(s)`}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {parsed.length > 0 && !results && (
            <>
              <Button variant="outline" onClick={resetState} disabled={importing}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Importando...</>
                ) : (
                  <>Importar {validCount} cliente(s)</>
                )}
              </Button>
            </>
          )}
          {results && (
            <Button onClick={() => { setOpen(false); resetState(); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
