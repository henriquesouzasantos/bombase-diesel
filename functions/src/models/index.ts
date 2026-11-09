import { Schema, Types, model } from 'mongoose';

/**
 * Modelos do MongoDB (diagrama de classes 7.5 da especificação).
 * Valores em reais são guardados como Number com 2 casas (arredondados no domínio).
 */

const opts = { timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' }, versionKey: false } as const;

/* ---------- CRM (RF01–RF03) ---------- */

const ClienteSchema = new Schema({
  tipo: { type: String, enum: ['PF', 'PJ'], required: true },
  nome: { type: String, required: true, trim: true },
  cpfCnpj: { type: String, required: true, trim: true, unique: true },
  telefone: String,
  email: { type: String, lowercase: true, trim: true },
  limiteCredito: { type: Number, default: 0, min: 0 },
  condicoesPagamento: String,
  consentimentoLgpdEm: Date,
  ultimaAtividadeEm: { type: Date, default: Date.now },
  anonimizadoEm: Date, // RE01
}, opts);
ClienteSchema.index({ nome: 'text' });
export const Cliente = model('Cliente', ClienteSchema, 'clientes');

const VeiculoSchema = new Schema({
  clienteId: { type: Types.ObjectId, ref: 'Cliente', required: true, index: true },
  placa: { type: String, required: true, uppercase: true, trim: true, unique: true },
  chassi: { type: String, required: true, uppercase: true, trim: true, unique: true },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  ano: Number,
  motor: String,
  hodometro: { type: Number, min: 0 },
  horimetro: { type: Number, min: 0 },
}, opts);
export const Veiculo = model('Veiculo', VeiculoSchema, 'veiculos');

/* ---------- Estoque (RF04–RF06) ---------- */

const PecaSchema = new Schema({
  sku: { type: String, required: true, uppercase: true, trim: true, unique: true },
  descricao: { type: String, required: true },
  unidade: { type: String, default: 'UN' },
  custo: { type: Number, required: true, min: 0 },
  margem: { type: Number, required: true, min: 0 },
  precoVenda: { type: Number, required: true, min: 0 },
  saldo: { type: Number, default: 0, min: 0 }, // min 0 reforça a RN01 (nunca negativo)
  estoqueMinimo: { type: Number, default: 0, min: 0 },
  localizacao: String,
}, opts);
export const Peca = model('Peca', PecaSchema, 'pecas');

const MovimentoEstoqueSchema = new Schema({
  pecaId: { type: Types.ObjectId, ref: 'Peca', required: true, index: true },
  tipo: { type: String, enum: ['ENTRADA', 'SAIDA', 'AJUSTE'], required: true },
  quantidade: { type: Number, required: true },
  osId: { type: Types.ObjectId, ref: 'OrdemServico' },
  documento: String, // NF-e de entrada
  usuario: String,
}, opts);
export const MovimentoEstoque = model('MovimentoEstoque', MovimentoEstoqueSchema, 'movimentos_estoque');

const FornecedorSchema = new Schema({
  nome: { type: String, required: true },
  cnpj: { type: String, required: true, unique: true },
  contato: String,
  telefone: String,
}, opts);
export const Fornecedor = model('Fornecedor', FornecedorSchema, 'fornecedores');

/* ---------- Ordens de serviço (RF07–RF09) ---------- */

export const STATUS_OS = ['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'QUALIDADE', 'CONCLUIDO', 'FATURADO'] as const;

const ItemOSSchema = new Schema({
  pecaId: { type: Types.ObjectId, ref: 'Peca', required: true },
  sku: String,
  descricao: String,
  quantidade: { type: Number, required: true, min: 1 },
  precoUnitario: { type: Number, required: true, min: 0 },
  baixado: { type: Boolean, default: false },
});

const ApontamentoSchema = new Schema({
  tecnico: { type: String, required: true },
  tecnicoUid: String,
  inicio: { type: String, required: true }, // HH:mm
  fim: { type: String, required: true },
  horas: { type: Number, required: true, min: 0 },
  valorHora: { type: Number, required: true, min: 0 },
  data: { type: Date, default: Date.now },
});

const OrdemServicoSchema = new Schema({
  numero: { type: Number, required: true, unique: true },
  veiculoId: { type: Types.ObjectId, ref: 'Veiculo', required: true, index: true },
  clienteId: { type: Types.ObjectId, ref: 'Cliente', required: true, index: true },
  descricao: { type: String, required: true },
  status: { type: String, enum: STATUS_OS, default: 'ABERTO', index: true },
  tecnico: String,
  itens: [ItemOSSchema],
  apontamentos: [ApontamentoSchema],
  dataEntrada: { type: Date, default: Date.now },
  concluidaEm: Date,
  faturadaEm: Date,
  valorTotal: Number,
  historico: [{ _id: false, status: String, em: { type: Date, default: Date.now }, por: String }],
}, opts);
export const OrdemServico = model('OrdemServico', OrdemServicoSchema, 'ordens_servico');

/** Sequência numérica (OS #1029, #1030…). */
const ContadorSchema = new Schema({ _id: String, valor: Number }, { versionKey: false });
export const Contador = model('Contador', ContadorSchema, 'contadores');

/* ---------- Financeiro (Entrega 2: RF10–RF20) ---------- */

const ContaBancariaSchema = new Schema({
  nomeBanco: { type: String, required: true },
  agencia: String,
  numeroConta: String,
  tipo: { type: String, enum: ['BANCO', 'CAIXA', 'PIX_PJ'], default: 'BANCO' },
  saldoAtual: { type: Number, default: 0 },
  ativa: { type: Boolean, default: true },
  taxasPadrao: { boleto: Number, cartaoPercentual: Number, pixPercentual: Number }, // RNF02.4
  diasCompensacao: { type: Number, default: 1 }, // N+k
}, opts);
export const ContaBancaria = model('ContaBancaria', ContaBancariaSchema, 'contas_bancarias');

const TransacaoFinanceiraSchema = new Schema({
  tipo: { type: String, enum: ['RECEBER', 'PAGAR', 'AVULSO_ENTRADA', 'AVULSO_SAIDA', 'ESTORNO'], required: true },
  natureza: { type: String, enum: ['ENTRADA', 'SAIDA'], required: true },
  status: { type: String, enum: ['PENDENTE', 'LIQUIDADO', 'CONCILIADO', 'CANCELADO'], default: 'PENDENTE' },
  contaId: { type: Types.ObjectId, ref: 'ContaBancaria' },
  osId: { type: Types.ObjectId, ref: 'OrdemServico' },
  favorecido: String,
  descricao: String,
  meio: { type: String, enum: ['PIX', 'BOLETO', 'CARTAO', 'TED', 'DINHEIRO'] },
  valorBruto: { type: Number, required: true },
  desconto: { type: Number, default: 0 },
  jurosMulta: { type: Number, default: 0 },
  taxaBancaria: { type: Number, default: 0 },
  valorLiquido: Number,
  dataVencimento: Date,
  dataEfetivacao: Date,
  dataCompensacao: Date,
  estornoDe: { type: Types.ObjectId, ref: 'TransacaoFinanceira' },
  hash: String,          // RNF02.2: SHA-256 do registro
  hashAnterior: String,  // encadeia a trilha de auditoria
  usuario: String,
}, opts);
TransacaoFinanceiraSchema.index({ status: 1, dataVencimento: 1 });
TransacaoFinanceiraSchema.index({ dataEfetivacao: -1 });
export const TransacaoFinanceira = model('TransacaoFinanceira', TransacaoFinanceiraSchema, 'transacoes');
