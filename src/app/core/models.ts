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
