import { Client, IrpfDemand, DemandStatus, BillingStatus, Priority, ChecklistItem, Question, HistoryEntry, Document } from './types';

const clients: Client[] = [
  { id: '1', name: 'Maria Silva', cpf: '123.456.789-00', phone: '11999990001', email: 'maria@email.com', created_at: '2026-01-10' },
  { id: '2', name: 'João Santos', cpf: '987.654.321-00', phone: '11999990002', email: 'joao@email.com', created_at: '2026-01-12' },
  { id: '3', name: 'Ana Oliveira', cpf: '111.222.333-44', phone: '11999990003', email: 'ana@email.com', created_at: '2026-01-15' },
  { id: '4', name: 'Carlos Souza', cpf: '555.666.777-88', phone: '11999990004', email: 'carlos@email.com', created_at: '2026-02-01' },
  { id: '5', name: 'Fernanda Lima', cpf: '999.888.777-66', phone: '11999990005', email: 'fernanda@email.com', created_at: '2026-02-05' },
  { id: '6', name: 'Roberto Costa', cpf: '222.333.444-55', phone: '11999990006', email: 'roberto@email.com', created_at: '2026-02-10' },
  { id: '7', name: 'Lucia Pereira', cpf: '444.555.666-77', phone: '11999990007', email: 'lucia@email.com', created_at: '2026-02-15' },
  { id: '8', name: 'Pedro Almeida', cpf: '777.888.999-00', phone: '11999990008', email: 'pedro@email.com', created_at: '2026-03-01' },
];

const statuses: DemandStatus[] = ['aguardando_cliente', 'documentos_em_analise', 'em_andamento', 'pendencia', 'finalizado'];
const billingStatuses: BillingStatus[] = ['nao_cobrado', 'cobrado', 'pago'];
const priorities: Priority[] = ['baixa', 'media', 'alta', 'urgente'];
const responsibles = ['Dra. Ana', 'Dr. Carlos', 'Marcos'];

export const mockDemands: IrpfDemand[] = clients.map((c, i) => ({
  id: `d${i + 1}`,
  client_id: c.id,
  year_base: 2025,
  responsible: responsibles[i % responsibles.length],
  status: statuses[i % statuses.length],
  priority: priorities[i % priorities.length],
  billing_status: billingStatuses[i % billingStatuses.length],
  fee_amount: 500 + (i * 100),
  internal_notes: i % 2 === 0 ? 'Cliente com situação complexa de investimentos' : '',
  client_message: 'Por favor, envie todos os informes de rendimentos o mais breve possível.',
  access_token: `token_${c.id}_${Date.now()}`,
  created_at: c.created_at,
  updated_at: c.created_at,
  client: c,
}));

export const mockChecklist: Record<string, ChecklistItem[]> = {};
mockDemands.forEach(d => {
  mockChecklist[d.id] = [
    { id: `ck1_${d.id}`, demand_id: d.id, label: 'Informe de Rendimentos (empregador)', checked: Math.random() > 0.5 },
    { id: `ck2_${d.id}`, demand_id: d.id, label: 'Informe de Rendimentos (banco)', checked: Math.random() > 0.5 },
    { id: `ck3_${d.id}`, demand_id: d.id, label: 'Comprovante de despesas médicas', checked: Math.random() > 0.7 },
    { id: `ck4_${d.id}`, demand_id: d.id, label: 'Documento de dependentes (CPF)', checked: Math.random() > 0.6 },
  ];
});

export const mockQuestions: Record<string, Question[]> = {};
mockDemands.forEach(d => {
  mockQuestions[d.id] = [
    { id: `q1_${d.id}`, demand_id: d.id, question_text: 'Você teve algum rendimento de aluguel em 2025?', answer_text: d.status !== 'aguardando_cliente' ? 'Sim, R$ 2.000/mês' : null, answered_at: d.status !== 'aguardando_cliente' ? '2026-02-20' : null, created_at: '2026-02-01' },
    { id: `q2_${d.id}`, demand_id: d.id, question_text: 'Houve compra ou venda de veículos?', answer_text: null, answered_at: null, created_at: '2026-02-01' },
  ];
});

export const mockHistory: Record<string, HistoryEntry[]> = {};
mockDemands.forEach(d => {
  mockHistory[d.id] = [
    { id: `h1_${d.id}`, demand_id: d.id, action: 'Demanda criada', details: 'Cadastro inicial do cliente', created_at: d.created_at },
    { id: `h2_${d.id}`, demand_id: d.id, action: 'Mensagem enviada', details: 'Link do portal enviado via WhatsApp', created_at: d.created_at },
  ];
});

export const mockDocuments: Record<string, Document[]> = {};
mockDemands.forEach(d => {
  mockDocuments[d.id] = d.status !== 'aguardando_cliente' ? [
    { id: `doc1_${d.id}`, demand_id: d.id, name: 'Informe de Rendimentos - Empresa X.pdf', file_url: '#', uploaded_by: 'client', category: 'Informe de Rendimentos', uploaded_at: '2026-02-15' },
  ] : [];
});
