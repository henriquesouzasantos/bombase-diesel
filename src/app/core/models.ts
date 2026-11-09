/**
 * Tipos compartilhados do domínio (espelham functions/src/models).
 * Se mudar algo aqui, mude também no backend.
 */
export type Perfil = 'ADMIN' | 'GERENTE_FINANCEIRO' | 'RECEPCAO' | 'TECNICO';

export const PERFIS: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  GERENTE_FINANCEIRO: 'Gerente financeiro',
  RECEPCAO: 'Recepção',
  TECNICO: 'Técnico de pátio',
};

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

export interface Cliente {
  _id?: string;
  tipo: 'PF' | 'PJ';
  nome: string;
  cpfCnpj: string;
  telefone?: string;
  email?: string;
  limiteCredito: number;
  condicoesPagamento?: string;
  consentimentoLgpdEm?: string;
  criadoEm?: string;
}

export interface Veiculo {
  _id?: string;
  clienteId: string;
  clienteNome?: string;
  placa: string;
  chassi: string;
  marca: string;
  modelo: string;
  ano: number;
  motor?: string;
  hodometro?: number;
  horimetro?: number;
}

export interface Peca {
  _id?: string;
  sku: string;
  descricao: string;
  unidade: string;
  custo: number;
  margem: number; // percentual, ex.: 35 = 35%
  precoVenda: number;
  saldo: number;
  estoqueMinimo: number;
  localizacao?: string;
}

export type StatusOS = 'ABERTO' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECAS' | 'QUALIDADE' | 'CONCLUIDO' | 'FATURADO';

export const STATUS_OS: { id: StatusOS; nome: string }[] = [
  { id: 'ABERTO', nome: 'Aberto' },
  { id: 'EM_ANDAMENTO', nome: 'Em andamento' },
  { id: 'AGUARDANDO_PECAS', nome: 'Aguardando peças' },
  { id: 'QUALIDADE', nome: 'Qualidade' },
  { id: 'CONCLUIDO', nome: 'Concluído' },
  { id: 'FATURADO', nome: 'Faturado' },
];

/** Transições permitidas (diagrama de estados 7.4 da especificação). */
export const TRANSICOES_OS: Record<StatusOS, StatusOS[]> = {
  ABERTO: ['EM_ANDAMENTO'],
  EM_ANDAMENTO: ['AGUARDANDO_PECAS', 'QUALIDADE'],
  AGUARDANDO_PECAS: ['EM_ANDAMENTO'],
  QUALIDADE: ['EM_ANDAMENTO', 'CONCLUIDO'],
  CONCLUIDO: ['FATURADO'],
  FATURADO: [],
};

export interface ItemOS {
  _id?: string;
  pecaId: string;
  sku: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  baixado: boolean;
}

export interface Apontamento {
  _id?: string;
  tecnico: string;
  inicio: string;
  fim: string;
  horas: number;
  valorHora: number;
}

export interface OrdemServico {
  _id?: string;
  numero: number;
  veiculoId: string;
  clienteId: string;
  veiculoDescricao?: string;
  clienteNome?: string;
  descricao: string;
  status: StatusOS;
  tecnico?: string;
  itens: ItemOS[];
  apontamentos: Apontamento[];
  dataEntrada: string;
  concluidaEm?: string;
  faturadaEm?: string;
  historico: { status: StatusOS; em: string; por: string }[];
}

export function totalOS(os: OrdemServico) {
  const pecas = os.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const maoDeObra = os.apontamentos.reduce((s, a) => s + a.horas * a.valorHora, 0);
  return { pecas, maoDeObra, total: Math.round((pecas + maoDeObra) * 100) / 100 };
}

/** RN01: nenhuma OS conclui/fatura com peça sem baixa física. */
export function pendenciasRN01(os: OrdemServico): ItemOS[] {
  return os.itens.filter((i) => !i.baixado);
}

/** RN02 (Entrega 2): Valor líquido = Bruto − Desconto + Juros/Multa − Taxa bancária. */
export function valorLiquido(bruto: number, desconto: number, jurosMulta: number, taxa: number) {
  return Math.round((bruto - desconto + jurosMulta - taxa) * 100) / 100;
}

export function precoVenda(custo: number, margem: number) {
  return Math.round(custo * (1 + margem / 100) * 100) / 100;
}

/* ---------- Financeiro (Entrega 2: RF10–RF20) ---------- */

export type TipoConta = 'BANCO' | 'CAIXA' | 'PIX_PJ';
export const TIPOS_CONTA: Record<TipoConta, string> = { BANCO: 'Conta bancária', CAIXA: 'Caixa da oficina', PIX_PJ: 'Conta PIX PJ' };

export interface ContaBancaria {
  _id?: string;
  nomeBanco: string;
  agencia?: string;
  numeroConta?: string;
  tipo: TipoConta;
  saldoAtual: number;
  ativa: boolean;
  diasCompensacao: number;
  taxasPadrao: { boleto: number; cartaoPercentual: number; pixPercentual: number };
}

export type TipoTransacao = 'RECEBER' | 'PAGAR' | 'AVULSO_ENTRADA' | 'AVULSO_SAIDA' | 'ESTORNO';
export type Natureza = 'ENTRADA' | 'SAIDA';
export type StatusTransacao = 'PENDENTE' | 'LIQUIDADO' | 'CONCILIADO' | 'CANCELADO';
export type Meio = 'PIX' | 'BOLETO' | 'CARTAO' | 'TED' | 'DINHEIRO';

export const TIPOS_TRANSACAO: Record<TipoTransacao, string> = {
  RECEBER: 'A receber', PAGAR: 'A pagar', AVULSO_ENTRADA: 'Entrada avulsa', AVULSO_SAIDA: 'Saída avulsa', ESTORNO: 'Estorno',
};
export const STATUS_TRANSACAO: Record<StatusTransacao, string> = {
  PENDENTE: 'Pendente', LIQUIDADO: 'Liquidado', CONCILIADO: 'Conciliado', CANCELADO: 'Cancelado',
};
export const MEIOS: Record<Meio, string> = { PIX: 'PIX', BOLETO: 'Boleto', CARTAO: 'Cartão', TED: 'TED', DINHEIRO: 'Dinheiro' };

export interface TransacaoFinanceira {
  _id?: string;
  tipo: TipoTransacao;
  natureza: Natureza;
  status: StatusTransacao;
  contaId?: string;
  contaNome?: string;
  osId?: string;
  osNumero?: number;
  favorecido?: string;
  descricao?: string;
  meio?: Meio;
  valorBruto: number;
  desconto?: number;
  jurosMulta?: number;
  taxaBancaria?: number;
  valorLiquido?: number;
  dataVencimento?: string;
  dataEfetivacao?: string;
  dataCompensacao?: string;
  estornoDe?: string;
  hash?: string;
  hashAnterior?: string;
  usuario?: string;
  criadoEm?: string;
}

export interface Liquidez {
  hoje: string;
  d1: string;
  contas: { contaId: string; nomeBanco: string; saldoAtual: number; aCompensar: number; disponivel: number }[];
  disponivelHoje: number;
  projecaoD1: number;
  vencidos: { receber: number; pagar: number };
  dias: { data: string; entradas: number; saidas: number; saldo: number }[];
}

export interface UsuarioAdmin {
  uid: string;
  email: string;
  nome: string;
  perfil: Perfil | null;
  desativado?: boolean;
}

const cent = (v: number) => Math.round(v * 100) / 100;

export const naturezaDe = (tipo: Exclude<TipoTransacao, 'ESTORNO'>): Natureza =>
  tipo === 'RECEBER' || tipo === 'AVULSO_ENTRADA' ? 'ENTRADA' : 'SAIDA';

/** Entrada: RN02. Saída: a taxa bancária é custo nosso e soma. Espelha functions/src/domain/regras.ts. */
export const valorEfetivo = (natureza: Natureza, bruto: number, desconto: number, jurosMulta: number, taxa: number) =>
  natureza === 'ENTRADA' ? valorLiquido(bruto, desconto, jurosMulta, taxa) : cent(bruto - desconto + jurosMulta + taxa);

/** Multa fixa + juros simples ao dia sobre o bruto (2% + 0,033%/dia). */
export function jurosMultaAtraso(bruto: number, diasAtraso: number, multaPct = 2, jurosDiaPct = 0.033) {
  if (diasAtraso <= 0) return 0;
  return cent(bruto * (multaPct / 100) + bruto * (jurosDiaPct / 100) * diasAtraso);
}

/** Taxa sugerida pela tabela da conta (RNF02.4). */
export function taxaSugerida(conta: ContaBancaria | undefined, meio: Meio, bruto: number) {
  if (!conta) return 0;
  const t = conta.taxasPadrao ?? { boleto: 0, cartaoPercentual: 0, pixPercentual: 0 };
  if (meio === 'BOLETO') return cent(t.boleto ?? 0);
  if (meio === 'CARTAO') return cent(bruto * (t.cartaoPercentual ?? 0) / 100);
  if (meio === 'PIX') return cent(bruto * (t.pixPercentual ?? 0) / 100);
  return 0;
}

export function somarDiasUteis(data: Date, dias: number) {
  const d = new Date(data);
  let falta = dias;
  while (falta > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) falta--;
  }
  return d;
}

export function prazoDias(condicoes?: string | null) {
  const m = condicoes?.match(/(\d+)\s*dias?/i);
  return m ? Number(m[1]) : 0;
}

/** Dias inteiros de atraso de um vencimento em relação a hoje (0 se ainda não venceu). */
export function diasAtraso(vencimento?: string, hoje = new Date()) {
  if (!vencimento) return 0;
  const v = new Date(vencimento); v.setHours(0, 0, 0, 0);
  const h = new Date(hoje); h.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((h.getTime() - v.getTime()) / 864e5));
}
