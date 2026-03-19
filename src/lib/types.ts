export type DemandStatus = 'aguardando_cliente' | 'documentos_em_analise' | 'em_andamento' | 'pendencia' | 'finalizado';
export type BillingStatus = 'nao_cobrado' | 'cobrado' | 'pago';
export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export const STATUS_LABELS: Record<DemandStatus, string> = {
  aguardando_cliente: 'Aguardando Cliente',
  documentos_em_analise: 'Documentos em Análise',
  em_andamento: 'Em Andamento',
  pendencia: 'Pendência',
  finalizado: 'Finalizado',
};

export const BILLING_LABELS: Record<BillingStatus, string> = {
  nao_cobrado: 'Não Cobrado',
  cobrado: 'Cobrado',
  pago: 'Pago',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export interface Client {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface IrpfDemand {
  id: string;
  client_id: string;
  year_base: number;
  responsible: string;
  status: DemandStatus;
  priority: Priority;
  billing_status: BillingStatus;
  fee_amount: number;
  internal_notes: string;
  client_message: string;
  access_token: string;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Document {
  id: string;
  demand_id: string;
  name: string;
  file_url: string;
  uploaded_by: 'office' | 'client';
  category: string;
  uploaded_at: string;
}

export interface Question {
  id: string;
  demand_id: string;
  question_text: string;
  answer_text: string | null;
  answered_at: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  demand_id: string;
  action: string;
  details: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  demand_id: string;
  label: string;
  checked: boolean;
}

export const REQUIRED_DOCUMENTS = [
  'Informe de Rendimentos (empregador)',
  'Informe de Rendimentos (banco)',
  'Informe de Rendimentos (corretora)',
  'Comprovante de despesas médicas',
  'Comprovante de despesas com educação',
  'Recibo de aluguel pago/recebido',
  'DARF de carnê-leão',
  'Comprovante de compra/venda de imóvel',
  'Comprovante de compra/venda de veículo',
  'Documento de dependentes (CPF)',
  'Recibo de pensão alimentícia',
  'Declaração do ano anterior (recibo)',
];
