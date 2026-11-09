import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Cliente, ContaBancaria, Liquidez, Meio, Natureza, OrdemServico, Peca, Perfil, StatusOS, TRANSICOES_OS, TransacaoFinanceira,
  UsuarioAdmin, Veiculo, naturezaDe, pendenciasRN01, prazoDias, precoVenda, somarDiasUteis, totalOS, valorEfetivo,
} from './models';

/**
 * Backend de demonstração (só roda com environment.demo = true).
 * Responde às mesmas rotas da API real, com os mesmos erros de regra de negócio,
 * usando dados em memória. Recarregar a página volta aos dados iniciais.
 */

let seq = 100;
const id = () => 'd' + (++seq);
const agora = () => new Date().toISOString();
const diasAtras = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

const clientes: Cliente[] = [
  { _id: 'c1', tipo: 'PJ', nome: 'Transportes Sul Ltda', cpfCnpj: '12.345.678/0001-90', telefone: '(35) 3621-4410', email: 'frota@transportessul.com.br', limiteCredito: 80000, condicoesPagamento: '28 dias · boleto', criadoEm: diasAtras(400) },
  { _id: 'c2', tipo: 'PJ', nome: 'Frota Minas Logística', cpfCnpj: '45.678.901/0001-23', telefone: '(31) 3333-2211', limiteCredito: 60000, condicoesPagamento: '21 dias · boleto', criadoEm: diasAtras(300) },
  { _id: 'c3', tipo: 'PJ', nome: 'Rodolog Cargas Ltda', cpfCnpj: '56.789.012/0001-34', telefone: '(35) 3629-7712', limiteCredito: 40000, condicoesPagamento: 'À vista · PIX', criadoEm: diasAtras(120) },
  { _id: 'c4', tipo: 'PF', nome: 'Carlos Eduardo Ramos', cpfCnpj: '123.456.789-09', telefone: '(35) 99812-3344', limiteCredito: 10000, condicoesPagamento: 'Cartão', criadoEm: diasAtras(60) },
];

const veiculos: Veiculo[] = [
  { _id: 'v1', clienteId: 'c1', placa: 'ABC-1D23', chassi: '9BSR6X400M3912345', marca: 'Scania', modelo: 'R450', ano: 2021, motor: 'DC13 450cv', hodometro: 530990 },
  { _id: 'v2', clienteId: 'c2', placa: 'QWE-4R56', chassi: '9BM958075LB112233', marca: 'Mercedes-Benz', modelo: 'Actros 2651', ano: 2020, motor: 'OM 471', hodometro: 701233 },
  { _id: 'v3', clienteId: 'c3', placa: 'PLK-8J76', chassi: '9BSG4X200N3987654', marca: 'Scania', modelo: 'G440', ano: 2022, motor: 'DC13 440cv', hodometro: 154220 },
  { _id: 'v4', clienteId: 'c1', placa: 'ZXC-9V87', chassi: 'YV2RT40A5LB345678', marca: 'Volvo', modelo: 'FH 540', ano: 2020, motor: 'D13K 540', hodometro: 389115 },
  { _id: 'v5', clienteId: 'c4', placa: 'RTY-7U89', chassi: '93ZS2RHH0P8456789', marca: 'Iveco', modelo: 'S-Way 480', ano: 2023, motor: 'Cursor 13', hodometro: 98640 },
];

const pecas: Peca[] = [
  { _id: 'p1', sku: 'BI-0445', descricao: 'Bico injetor Bosch 0445120', unidade: 'UN', custo: 1450, margem: 35, precoVenda: precoVenda(1450, 35), saldo: 6, estoqueMinimo: 4, localizacao: 'Gaveta C1' },
  { _id: 'p2', sku: 'FC-1060', descricao: 'Filtro de combustível MANN WK 1060/3', unidade: 'UN', custo: 86, margem: 40, precoVenda: precoVenda(86, 40), saldo: 4, estoqueMinimo: 10, localizacao: 'Prateleira A3' },
  { _id: 'p3', sku: 'AN-22', descricao: 'Anel de vedação 22 mm', unidade: 'UN', custo: 3.9, margem: 60, precoVenda: precoVenda(3.9, 60), saldo: 16, estoqueMinimo: 10, localizacao: 'Gaveta B2' },
  { _id: 'p4', sku: 'KT-430', descricao: 'Kit embreagem 430 mm', unidade: 'KT', custo: 4200, margem: 30, precoVenda: precoVenda(4200, 30), saldo: 1, estoqueMinimo: 2, localizacao: 'Depósito' },
  { _id: 'p5', sku: 'BP-CR4', descricao: 'Bomba de alta pressão CP4 (remanufaturada)', unidade: 'UN', custo: 5780, margem: 25, precoVenda: precoVenda(5780, 25), saldo: 2, estoqueMinimo: 1, localizacao: 'Depósito' },
  { _id: 'p6', sku: 'LB-15W40', descricao: 'Óleo Lubrax Extra Turbo 15W40 (L)', unidade: 'L', custo: 24, margem: 45, precoVenda: precoVenda(24, 45), saldo: 120, estoqueMinimo: 60, localizacao: 'Tambor 2' },
];

function os(n: number, v: string, desc: string, status: StatusOS, dias: number, extra: Partial<OrdemServico> = {}): OrdemServico {
  const vei = veiculos.find((x) => x._id === v)!;
  return {
    _id: 'o' + n, numero: n, veiculoId: v, clienteId: vei.clienteId, descricao: desc, status,
    itens: [], apontamentos: [], dataEntrada: diasAtras(dias),
    historico: [{ status: 'ABERTO', em: diasAtras(dias), por: 'Recepção' }], ...extra,
  };
}

const ordens: OrdemServico[] = [
  os(1029, 'v1', 'Bomba injetora — revisão completa', 'EM_ANDAMENTO', 11, {
    tecnico: 'J. Pereira',
    itens: [
      { _id: 'i1', pecaId: 'p1', sku: 'BI-0445', descricao: 'Bico injetor Bosch 0445120', quantidade: 2, precoUnitario: precoVenda(1450, 35), baixado: true },
      { _id: 'i2', pecaId: 'p3', sku: 'AN-22', descricao: 'Anel de vedação 22 mm', quantidade: 12, precoUnitario: precoVenda(3.9, 60), baixado: false },
    ],
    apontamentos: [{ _id: 'a1', tecnico: 'J. Pereira', inicio: '08:10', fim: '10:40', horas: 2.5, valorHora: 180 }],
  }),
  os(1036, 'v2', 'Troca do kit de embreagem', 'AGUARDANDO_PECAS', 6, { tecnico: 'M. Alves' }),
  os(1038, 'v4', 'Troca de óleo e filtros (motor/câmbio)', 'QUALIDADE', 4, { tecnico: 'M. Alves' }),
  os(1040, 'v3', 'Diagnóstico — falha no ABS', 'EM_ANDAMENTO', 3, { tecnico: 'J. Pereira' }),
  os(1047, 'v5', 'Revisão 300 mil km', 'ABERTO', 1),
  os(1052, 'v3', 'Bico injetor falhando no cilindro 4', 'ABERTO', 0),
  os(1021, 'v1', 'Calibração de bicos', 'FATURADO', 40, { concluidaEm: diasAtras(36), faturadaEm: diasAtras(35),
    apontamentos: [{ _id: 'a2', tecnico: 'J. Pereira', inicio: '13:00', fim: '17:00', horas: 4, valorHora: 180 }] }),
];

/* ---------------- financeiro (Entrega 2) ---------------- */

const diasFrente = (d: number, h = 12) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };

const contas: ContaBancaria[] = [
  { _id: 'b1', nomeBanco: 'Banco do Brasil', agencia: '0412-7', numeroConta: '45.120-3', tipo: 'BANCO', saldoAtual: 48230.55, ativa: true, diasCompensacao: 1, taxasPadrao: { boleto: 2.9, cartaoPercentual: 2.49, pixPercentual: 0 } },
  { _id: 'b2', nomeBanco: 'Sicoob Credivaz', agencia: '3092', numeroConta: '88.214-0', tipo: 'BANCO', saldoAtual: 21740.1, ativa: true, diasCompensacao: 2, taxasPadrao: { boleto: 1.95, cartaoPercentual: 2.2, pixPercentual: 0 } },
  { _id: 'b3', nomeBanco: 'Inter PJ (PIX)', tipo: 'PIX_PJ', saldoAtual: 9310, ativa: true, diasCompensacao: 0, taxasPadrao: { boleto: 0, cartaoPercentual: 0, pixPercentual: 0 } },
  { _id: 'b4', nomeBanco: 'Caixa da oficina', tipo: 'CAIXA', saldoAtual: 1280, ativa: true, diasCompensacao: 0, taxasPadrao: { boleto: 0, cartaoPercentual: 0, pixPercentual: 0 } },
];

function tr(n: number, t: Partial<TransacaoFinanceira> & Pick<TransacaoFinanceira, 'tipo' | 'valorBruto'>): TransacaoFinanceira {
  const natureza: Natureza = t.natureza ?? naturezaDe(t.tipo as Exclude<typeof t.tipo, 'ESTORNO'>);
  return { _id: 't' + n, natureza, status: 'PENDENTE', desconto: 0, jurosMulta: 0, taxaBancaria: 0, criadoEm: diasAtras(30), usuario: 'financeiro@demo', ...t };
}

const transacoes: TransacaoFinanceira[] = [
  tr(1, { tipo: 'RECEBER', status: 'LIQUIDADO', osId: 'o1021', favorecido: 'Transportes Sul Ltda', descricao: 'OS #1021', valorBruto: 720, valorLiquido: 717.1, taxaBancaria: 2.9, contaId: 'b1', meio: 'BOLETO', dataVencimento: diasAtras(7), dataEfetivacao: diasAtras(7), dataCompensacao: diasAtras(6) }),
  tr(2, { tipo: 'RECEBER', status: 'LIQUIDADO', favorecido: 'Frota Minas Logística', descricao: 'OS #1012 · revisão de bomba', valorBruto: 6200, desconto: 150, jurosMulta: 128.09, taxaBancaria: 2.9, valorLiquido: 6175.19, contaId: 'b1', meio: 'BOLETO', dataVencimento: diasAtras(3), dataEfetivacao: diasAtras(1), dataCompensacao: diasFrente(0, 23) }),
  tr(3, { tipo: 'RECEBER', status: 'LIQUIDADO', favorecido: 'Rodolog Cargas Ltda', descricao: 'OS #1015 · cartão', valorBruto: 3480, taxaBancaria: 76.56, valorLiquido: 3403.44, contaId: 'b2', meio: 'CARTAO', dataVencimento: diasAtras(0), dataEfetivacao: diasAtras(0), dataCompensacao: somarDiasUteis(new Date(), 2).toISOString() }),
  tr(4, { tipo: 'AVULSO_ENTRADA', status: 'CONCILIADO', favorecido: 'Carlos Eduardo Ramos', descricao: 'Calibração avulsa (PIX)', valorBruto: 450, valorLiquido: 450, contaId: 'b3', meio: 'PIX', dataEfetivacao: diasAtras(4), dataCompensacao: diasAtras(4) }),
  tr(5, { tipo: 'PAGAR', status: 'LIQUIDADO', favorecido: 'Bosch Distribuidora', descricao: 'NF 18.442 · bicos injetores', valorBruto: 8700, valorLiquido: 8700, contaId: 'b1', meio: 'TED', dataVencimento: diasAtras(5), dataEfetivacao: diasAtras(5), dataCompensacao: diasAtras(5) }),
  tr(6, { tipo: 'AVULSO_SAIDA', status: 'LIQUIDADO', favorecido: 'Cemig', descricao: 'Energia elétrica outubro', valorBruto: 1890.4, valorLiquido: 1890.4, contaId: 'b2', meio: 'BOLETO', dataEfetivacao: diasAtras(2), dataCompensacao: diasAtras(2) }),
  tr(7, { tipo: 'RECEBER', favorecido: 'Transportes Sul Ltda', descricao: 'OS #1018 · troca de bicos', valorBruto: 4365, dataVencimento: diasFrente(1) }),
  tr(8, { tipo: 'RECEBER', favorecido: 'Frota Minas Logística', descricao: 'OS #1019 · embreagem', valorBruto: 7920, dataVencimento: diasFrente(4) }),
  tr(9, { tipo: 'RECEBER', favorecido: 'Rodolog Cargas Ltda', descricao: 'OS #1016 · diagnóstico eletrônico', valorBruto: 980, dataVencimento: diasAtras(6) }),
  tr(10, { tipo: 'PAGAR', favorecido: 'MANN+HUMMEL', descricao: 'NF 7.310 · filtros', valorBruto: 2150, dataVencimento: diasFrente(0) }),
  tr(11, { tipo: 'PAGAR', favorecido: 'Folha de pagamento', descricao: 'Salários novembro', valorBruto: 18400, dataVencimento: diasFrente(5) }),
  tr(12, { tipo: 'PAGAR', favorecido: 'Aluguel do galpão', descricao: 'Aluguel novembro', valorBruto: 6500, dataVencimento: diasAtras(1) }),
];

const usuariosDemo: UsuarioAdmin[] = [
  { uid: 'u1', email: 'admin@bombase.com.br', nome: 'Administrador', perfil: 'ADMIN' },
  { uid: 'u2', email: 'financeiro@bombase.com.br', nome: 'Ana Souza', perfil: 'GERENTE_FINANCEIRO' },
  { uid: 'u3', email: 'recepcao@bombase.com.br', nome: 'Paula Lima', perfil: 'RECEPCAO' },
  { uid: 'u4', email: 'jpereira@bombase.com.br', nome: 'J. Pereira', perfil: 'TECNICO' },
  { uid: 'u5', email: 'malves@bombase.com.br', nome: 'M. Alves', perfil: 'TECNICO' },
  { uid: 'u6', email: 'estagio@bombase.com.br', nome: 'Estagiário 2025', perfil: null, desativado: true },
];

const PERFIS_VALIDOS: Perfil[] = ['ADMIN', 'GERENTE_FINANCEIRO', 'RECEPCAO', 'TECNICO'];
const MEIOS_VALIDOS: Meio[] = ['PIX', 'BOLETO', 'CARTAO', 'TED', 'DINHEIRO'];
const cent = (v: number) => Math.round(v * 100) / 100;
const compensa = (natureza: Natureza, meio: Meio | undefined, efetivacao: Date, diasConta: number) =>
  natureza === 'SAIDA' || meio === 'PIX' || meio === 'DINHEIRO' ? efetivacao : somarDiasUteis(efetivacao, diasConta);
const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mesma conta de functions/src/domain/regras.ts → calcularLiquidez. */
function liquidez(): Liquidez {
  const agora = new Date();
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const d1 = somarDiasUteis(agora, 1); d1.setHours(0, 0, 0, 0);
  const aCompensar = transacoes.filter((t) => (t.status === 'LIQUIDADO' || t.status === 'CONCILIADO') && t.natureza === 'ENTRADA' && t.dataCompensacao && new Date(t.dataCompensacao) > agora);
  const pendentes = transacoes.filter((t) => t.status === 'PENDENTE' && t.dataVencimento);
  const porConta = contas.filter((c) => c.ativa).map((c) => {
    const comp = cent(aCompensar.filter((t) => t.contaId === c._id).reduce((s, t) => s + (t.valorLiquido ?? 0), 0));
    return { contaId: c._id!, nomeBanco: c.nomeBanco, saldoAtual: cent(c.saldoAtual), aCompensar: comp, disponivel: cent(c.saldoAtual - comp) };
  });
  const disponivelHoje = cent(porConta.reduce((s, c) => s + c.disponivel, 0));
  const vencidos = { receber: 0, pagar: 0 };
  for (const t of pendentes) if (new Date(t.dataVencimento!) < hoje) vencidos[t.natureza === 'ENTRADA' ? 'receber' : 'pagar'] += t.valorBruto;
  const dias: Liquidez['dias'] = [];
  let saldo = disponivelHoje;
  let projecaoD1 = disponivelHoje;
  for (let i = 0; i < 7; i++) {
    const dia = new Date(hoje); dia.setDate(hoje.getDate() + i);
    const k = chaveDia(dia);
    const doDia = (d?: string) => !!d && chaveDia(new Date(d)) === k;
    const entradas = cent(aCompensar.filter((t) => doDia(t.dataCompensacao)).reduce((s, t) => s + (t.valorLiquido ?? 0), 0)
      + pendentes.filter((t) => t.natureza === 'ENTRADA' && doDia(t.dataVencimento)).reduce((s, t) => s + t.valorBruto, 0));
    const saidas = cent(pendentes.filter((t) => t.natureza === 'SAIDA' && (doDia(t.dataVencimento) || (i === 0 && new Date(t.dataVencimento!) < hoje))).reduce((s, t) => s + t.valorBruto, 0));
    saldo = cent(saldo + entradas - saidas);
    dias.push({ data: k, entradas, saidas, saldo });
    if (dia <= d1) projecaoD1 = saldo;
  }
  return { hoje: chaveDia(hoje), d1: chaveDia(d1), contas: porConta, disponivelHoje, projecaoD1, vencidos: { receber: cent(vencidos.receber), pagar: cent(vencidos.pagar) }, dias };
}

/* ---------------- helpers ---------------- */

class Erro { constructor(public status: number, public erro: string) {} }

const PODE: Record<string, Perfil[]> = {
  cadastro: ['RECEPCAO'],
  estoque: ['RECEPCAO'],
  abrirOS: ['RECEPCAO'],
  operarOS: ['RECEPCAO', 'TECNICO'],
  faturar: ['RECEPCAO', 'GERENTE_FINANCEIRO'],
  financeiro: ['GERENTE_FINANCEIRO'],
  admin: [],
};

function exigir(perfil: Perfil, acao: keyof typeof PODE) {
  if (perfil !== 'ADMIN' && !PODE[acao].includes(perfil)) throw new Erro(403, 'Seu perfil não tem permissão para esta ação.');
}

const nomeCliente = (cid: string) => clientes.find((c) => c._id === cid)?.nome;
const descVeiculo = (vid: string) => { const v = veiculos.find((x) => x._id === vid); return v ? `${v.marca} ${v.modelo} · ${v.placa}` : ''; };
const enriquecer = (o: OrdemServico): OrdemServico => ({ ...o, clienteNome: nomeCliente(o.clienteId), veiculoDescricao: descVeiculo(o.veiculoId) });
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const filtra = <T>(lista: T[], busca: string, campos: (keyof T)[]) => {
  const b = busca.trim().toLowerCase();
  return b ? lista.filter((x) => campos.some((c) => String(x[c] ?? '').toLowerCase().includes(b))) : lista;
};
const achar = <T extends { _id?: string }>(lista: T[], i: string, nome: string) => {
  const x = lista.find((y) => y._id === i);
  if (!x) throw new Erro(404, `${nome} não encontrado(a).`);
  return x;
};

function rota(req: HttpRequest<any>, perfil: Perfil): unknown {
  const url = new URL(req.urlWithParams, 'http://x');
  const p = url.pathname.replace(/^\/api/, '').split('/').filter(Boolean);
  const busca = url.searchParams.get('busca') ?? '';
  const m = req.method;
  const b = req.body ?? {};

  if (p[0] === 'painel') {
    const porStatus = Object.fromEntries(['ABERTO', 'EM_ANDAMENTO', 'AGUARDANDO_PECAS', 'QUALIDADE', 'CONCLUIDO', 'FATURADO'].map((s) => [s, ordens.filter((o) => o.status === s).length]));
    const mes = new Date().getMonth();
    return {
      osAbertas: ordens.filter((o) => o.status !== 'FATURADO').length,
      osPorStatus: porStatus,
      pecasAbaixoMinimo: pecas.filter((x) => x.saldo < x.estoqueMinimo),
      clientes: clientes.length,
      veiculos: veiculos.length,
      faturadoMes: ordens.filter((o) => o.faturadaEm && new Date(o.faturadaEm).getMonth() === mes).reduce((s, o) => s + totalOS(o).total, 0),
      ultimasOS: [...ordens].sort((a, z) => z.numero - a.numero).slice(0, 5).map(enriquecer),
    };
  }

  if (p[0] === 'clientes') {
    if (m === 'GET' && !p[1]) return filtra(clientes, busca, ['nome', 'cpfCnpj']);
    if (m === 'GET') return achar(clientes, p[1], 'Cliente');
    exigir(perfil, 'cadastro');
    if (!b.nome || !b.cpfCnpj) throw new Erro(400, 'Informe nome e CPF/CNPJ.');
    if (clientes.some((c) => c.cpfCnpj === b.cpfCnpj && c._id !== p[1])) throw new Erro(409, 'Já existe um cliente com este CPF/CNPJ.');
    if (m === 'POST') { const c = { ...b, _id: id(), criadoEm: agora() }; clientes.push(c); return c; }
    if (m === 'PUT') { Object.assign(achar(clientes, p[1], 'Cliente'), b); return achar(clientes, p[1], 'Cliente'); }
  }

  if (p[0] === 'veiculos') {
    const comNome = (v: Veiculo) => ({ ...v, clienteNome: nomeCliente(v.clienteId) });
    if (m === 'GET' && !p[1]) return filtra(veiculos.map(comNome), busca, ['placa', 'chassi', 'modelo', 'clienteNome']);
    if (m === 'GET' && p[2] === 'historico') return ordens.filter((o) => o.veiculoId === p[1]).sort((a, z) => z.numero - a.numero).map(enriquecer);
    if (m === 'GET') return comNome(achar(veiculos, p[1], 'Veículo'));
    exigir(perfil, 'cadastro');
    if (!b.placa || !b.chassi || !b.clienteId) throw new Erro(400, 'Informe cliente, placa e chassi.');
    if (veiculos.some((v) => (v.placa === b.placa || v.chassi === b.chassi) && v._id !== p[1])) throw new Erro(409, 'Placa ou chassi já cadastrado.');
    if (m === 'POST') { const v = { ...b, _id: id() }; veiculos.push(v); return v; }
    if (m === 'PUT') { Object.assign(achar(veiculos, p[1], 'Veículo'), b); return achar(veiculos, p[1], 'Veículo'); }
  }

  if (p[0] === 'pecas') {
    if (m === 'GET') return filtra(pecas, busca, ['sku', 'descricao']);
    exigir(perfil, 'estoque');
    if (p[2] === 'entrada') {
      const x = achar(pecas, p[1], 'Peça');
      const q = Number(b.quantidade);
      if (!(q > 0)) throw new Erro(400, 'Quantidade deve ser maior que zero.');
      x.saldo += q;
      return x;
    }
    if (!b.sku || !b.descricao) throw new Erro(400, 'Informe SKU e descrição.');
    if (pecas.some((x) => x.sku === b.sku && x._id !== p[1])) throw new Erro(409, 'SKU já cadastrado.');
    const dados = { ...b, precoVenda: precoVenda(+b.custo, +b.margem) };
    if (m === 'POST') { const x = { ...dados, _id: id(), saldo: +b.saldo || 0 }; pecas.push(x); return x; }
    if (m === 'PUT') { const x = achar(pecas, p[1], 'Peça'); const { saldo, ...resto } = dados; Object.assign(x, resto); return x; }
  }

  if (p[0] === 'os') {
    if (m === 'GET' && !p[1]) return ordens.map(enriquecer).sort((a, z) => z.numero - a.numero);
    if (m === 'GET') return enriquecer(achar(ordens, p[1], 'OS'));
    if (m === 'POST' && !p[1]) {
      exigir(perfil, 'abrirOS');
      const v = achar(veiculos, b.veiculoId, 'Veículo');
      if (!b.descricao) throw new Erro(400, 'Descreva o serviço.');
      const n = Math.max(...ordens.map((o) => o.numero)) + 1;
      const o: OrdemServico = { _id: id(), numero: n, veiculoId: v._id!, clienteId: v.clienteId, descricao: b.descricao, status: 'ABERTO', itens: [], apontamentos: [], dataEntrada: agora(), historico: [{ status: 'ABERTO', em: agora(), por: perfil }] };
      ordens.push(o);
      return enriquecer(o);
    }
    const o = achar(ordens, p[1], 'OS');
    if (p[2] === 'status') {
      const novo = b.status as StatusOS;
      if (!TRANSICOES_OS[o.status].includes(novo)) throw new Erro(422, 'Esta mudança de status não é permitida.');
      exigir(perfil, novo === 'FATURADO' || novo === 'CONCLUIDO' ? 'faturar' : 'operarOS');
      if (novo === 'CONCLUIDO' || novo === 'FATURADO') {
        const pend = pendenciasRN01(o);
        if (pend.length) throw new Erro(422, `RN01: ${pend.length} peça(s) sem baixa física no estoque (${pend.map((i) => i.sku).join(', ')}).`);
      }
      o.status = novo;
      if (novo === 'CONCLUIDO') o.concluidaEm = agora();
      if (novo === 'FATURADO') {
        o.faturadaEm = agora();
        // RF09: faturar cria o título a receber do cliente.
        const cli = clientes.find((c) => c._id === o.clienteId);
        const venc = new Date(); venc.setDate(venc.getDate() + prazoDias(cli?.condicoesPagamento)); venc.setHours(12, 0, 0, 0);
        const total = totalOS(o).total;
        if (total > 0) transacoes.push({ _id: id(), tipo: 'RECEBER', natureza: 'ENTRADA', status: 'PENDENTE', osId: o._id, favorecido: cli?.nome, descricao: o.descricao,
          valorBruto: total, desconto: 0, jurosMulta: 0, taxaBancaria: 0, dataVencimento: venc.toISOString(), criadoEm: agora(), usuario: perfil });
      }
      o.historico.push({ status: novo, em: agora(), por: perfil });
      return enriquecer(o);
    }
    if (o.status === 'CONCLUIDO' || o.status === 'FATURADO') throw new Erro(422, 'OS concluída não pode ser alterada.');
    exigir(perfil, 'operarOS');
    if (p[2] === 'itens' && !p[3]) {
      const x = achar(pecas, b.pecaId, 'Peça');
      const q = Number(b.quantidade);
      if (!(q > 0)) throw new Erro(400, 'Quantidade deve ser maior que zero.');
      o.itens.push({ _id: id(), pecaId: x._id!, sku: x.sku, descricao: x.descricao, quantidade: q, precoUnitario: x.precoVenda, baixado: false });
      return enriquecer(o);
    }
    if (p[2] === 'itens' && p[4] === 'baixa') {
      const item = achar(o.itens, p[3], 'Item');
      if (item.baixado) throw new Erro(409, 'Este item já teve baixa.');
      const x = achar(pecas, item.pecaId, 'Peça');
      if (x.saldo < item.quantidade) throw new Erro(422, `Saldo insuficiente de ${x.sku}: ${x.saldo} ${x.unidade} em estoque.`);
      x.saldo -= item.quantidade;
      item.baixado = true;
      return enriquecer(o);
    }
    if (p[2] === 'apontamentos') {
      const [h1, m1] = String(b.inicio).split(':').map(Number);
      const [h2, m2] = String(b.fim).split(':').map(Number);
      const horas = Math.round(((h2 * 60 + m2 - h1 * 60 - m1) / 60) * 100) / 100;
      if (!(horas > 0)) throw new Erro(400, 'O fim precisa ser depois do início.');
      o.apontamentos.push({ _id: id(), tecnico: b.tecnico, inicio: b.inicio, fim: b.fim, horas, valorHora: +b.valorHora });
      return enriquecer(o);
    }
  }
  if (p[0] === 'financeiro') {
    exigir(perfil, 'financeiro');
    const enr = (t: TransacaoFinanceira): TransacaoFinanceira => ({
      ...t, contaNome: contas.find((c) => c._id === t.contaId)?.nomeBanco, osNumero: ordens.find((o) => o._id === t.osId)?.numero,
    });
    const saldo = (contaId: string | undefined, natureza: Natureza, v: number) => {
      const c = achar(contas, contaId!, 'Conta');
      c.saldoAtual = cent(c.saldoAtual + (natureza === 'ENTRADA' ? v : -v));
    };

    if (p[1] === 'liquidez') return liquidez();

    if (p[1] === 'contas') {
      if (m === 'GET') return [...contas].sort((a, z) => Number(z.ativa) - Number(a.ativa) || a.nomeBanco.localeCompare(z.nomeBanco));
      if (!b.nomeBanco || String(b.nomeBanco).trim().length < 2) throw new Erro(400, 'Informe o nome do banco ou da conta.');
      const dados = {
        nomeBanco: String(b.nomeBanco).trim(), agencia: b.agencia, numeroConta: b.numeroConta, tipo: b.tipo ?? 'BANCO', ativa: b.ativa !== false,
        diasCompensacao: Math.max(0, Math.round(+b.diasCompensacao || 0)),
        taxasPadrao: { boleto: +b.taxasPadrao?.boleto || 0, cartaoPercentual: +b.taxasPadrao?.cartaoPercentual || 0, pixPercentual: +b.taxasPadrao?.pixPercentual || 0 },
      };
      if (m === 'POST') { const c = { ...dados, _id: id(), saldoAtual: cent(+b.saldoAtual || 0) } as ContaBancaria; contas.push(c); return c; }
      if (m === 'PUT') { const c = achar(contas, p[2], 'Conta'); Object.assign(c, dados); return c; }
    }

    if (p[1] === 'transacoes') {
      const q = url.searchParams;
      if (m === 'GET') {
        const tipos = q.get('tipo')?.split(',');
        const sts = q.get('status')?.split(',');
        const conta = q.get('contaId');
        const campo = q.get('campo') === 'vencimento' ? 'dataVencimento' : 'dataEfetivacao';
        const de = q.get('de') ? new Date(q.get('de') + 'T00:00:00') : null;
        const ate = q.get('ate') ? new Date(q.get('ate') + 'T23:59:59.999') : null;
        const bq = (q.get('busca') ?? '').trim().toLowerCase();
        return transacoes
          .filter((t) => (!tipos || tipos.includes(t.tipo)) && (!sts || sts.includes(t.status)) && (!conta || t.contaId === conta))
          .filter((t) => { if (!de && !ate) return true; const d = t[campo]; if (!d) return false; const x = new Date(d); return (!de || x >= de) && (!ate || x <= ate); })
          .filter((t) => !bq || `${t.favorecido ?? ''} ${t.descricao ?? ''}`.toLowerCase().includes(bq))
          .sort((a, z) => String(z[campo] ?? '').localeCompare(String(a[campo] ?? '')))
          .map(enr);
      }
      if (m === 'POST' && !p[2]) {
        const tipo = b.tipo as TransacaoFinanceira['tipo'];
        if (!['RECEBER', 'PAGAR', 'AVULSO_ENTRADA', 'AVULSO_SAIDA'].includes(tipo)) throw new Erro(400, 'Tipo de lançamento inválido.');
        if (!b.descricao || String(b.descricao).trim().length < 3) throw new Erro(400, 'Descreva o lançamento.');
        const bruto = +b.valorBruto;
        if (!(bruto > 0)) throw new Erro(400, 'O valor precisa ser maior que zero.');
        if (b.meio && !MEIOS_VALIDOS.includes(b.meio)) throw new Erro(400, 'Meio de pagamento inválido.');
        const natureza = naturezaDe(tipo as Exclude<typeof tipo, 'ESTORNO'>);
        const base: TransacaoFinanceira = { _id: id(), tipo, natureza, status: 'PENDENTE', descricao: String(b.descricao).trim(), favorecido: b.favorecido, meio: b.meio,
          valorBruto: cent(bruto), desconto: 0, jurosMulta: 0, taxaBancaria: 0, criadoEm: agora(), usuario: perfil };
        if (tipo === 'RECEBER' || tipo === 'PAGAR') {
          if (!b.dataVencimento) throw new Erro(400, 'Informe o vencimento.');
          const t = { ...base, dataVencimento: b.dataVencimento };
          transacoes.push(t);
          return enr(t);
        }
        if (!b.contaId) throw new Erro(400, 'Escolha a conta do lançamento.');
        const c = achar(contas, b.contaId, 'Conta');
        if (!c.ativa) throw new Erro(422, 'Esta conta está inativa.');
        const taxa = +b.taxaBancaria || 0;
        const valor = valorEfetivo(natureza, bruto, 0, 0, taxa);
        if (valor <= 0) throw new Erro(422, 'O valor líquido precisa ser maior que zero.');
        const ag = new Date();
        const t = { ...base, status: 'LIQUIDADO' as const, contaId: c._id, taxaBancaria: taxa, valorLiquido: valor, dataEfetivacao: ag.toISOString(), dataCompensacao: compensa(natureza, b.meio, ag, c.diasCompensacao).toISOString() };
        saldo(c._id, natureza, valor);
        transacoes.push(t);
        return enr(t);
      }
      const t = achar(transacoes, p[2], 'Lançamento');
      if (p[3] === 'liquidar') {
        if (t.status !== 'PENDENTE') throw new Erro(409, 'Este título já foi liquidado ou cancelado.');
        const c = achar(contas, b.contaId, 'Conta');
        if (!c.ativa) throw new Erro(422, 'Esta conta está inativa.');
        if (!MEIOS_VALIDOS.includes(b.meio)) throw new Erro(400, 'Escolha o meio de pagamento.');
        const [desc, juros, taxa] = [+b.desconto || 0, +b.jurosMulta || 0, +b.taxaBancaria || 0];
        if (desc < 0 || juros < 0 || taxa < 0) throw new Erro(400, 'Valores não podem ser negativos.');
        const valor = valorEfetivo(t.natureza, t.valorBruto, desc, juros, taxa);
        if (valor <= 0) throw new Erro(422, 'O valor líquido precisa ser maior que zero.');
        const ef = b.dataEfetivacao ? new Date(b.dataEfetivacao) : new Date();
        Object.assign(t, { contaId: c._id, meio: b.meio, desconto: desc, jurosMulta: juros, taxaBancaria: taxa, valorLiquido: valor, status: 'LIQUIDADO',
          dataEfetivacao: ef.toISOString(), dataCompensacao: compensa(t.natureza, b.meio, ef, c.diasCompensacao).toISOString(), usuario: perfil });
        saldo(c._id, t.natureza, valor);
        return enr(t);
      }
      if (p[3] === 'estornar') {
        if (t.status !== 'LIQUIDADO' && t.status !== 'CONCILIADO') throw new Erro(409, 'Só lançamentos liquidados podem ser estornados.');
        if (t.tipo === 'ESTORNO') throw new Erro(409, 'Um estorno não pode ser estornado.');
        const natureza: Natureza = t.natureza === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
        const v = t.valorLiquido ?? 0;
        const est: TransacaoFinanceira = { _id: id(), tipo: 'ESTORNO', natureza, status: 'LIQUIDADO', contaId: t.contaId, osId: t.osId, favorecido: t.favorecido,
          descricao: `Estorno: ${t.descricao ?? t.tipo}`, valorBruto: v, valorLiquido: v, desconto: 0, jurosMulta: 0, taxaBancaria: 0,
          dataEfetivacao: agora(), dataCompensacao: agora(), estornoDe: t._id, criadoEm: agora(), usuario: perfil };
        t.status = 'CANCELADO';
        saldo(t.contaId, natureza, v);
        transacoes.push(est);
        return enr(est);
      }
      if (p[3] === 'cancelar') {
        if (t.status !== 'PENDENTE') throw new Erro(409, 'Só títulos pendentes podem ser cancelados. Use o estorno.');
        t.status = 'CANCELADO';
        return enr(t);
      }
      if (p[3] === 'conciliar') {
        if (t.status !== 'LIQUIDADO') throw new Erro(409, 'Só lançamentos liquidados podem ser conciliados.');
        t.status = 'CONCILIADO';
        return enr(t);
      }
    }
  }

  if (p[0] === 'usuarios') {
    exigir(perfil, 'admin');
    if (m === 'GET') return usuariosDemo;
    if (m === 'POST') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email ?? '')) throw new Erro(400, 'email: Invalid email');
      if (!b.nome || String(b.nome).trim().length < 2) throw new Erro(400, 'nome: informe o nome.');
      if (!b.senha || String(b.senha).length < 8) throw new Erro(400, 'senha: mínimo de 8 caracteres.');
      if (!PERFIS_VALIDOS.includes(b.perfil)) throw new Erro(400, 'perfil: perfil inválido.');
      if (usuariosDemo.some((u) => u.email === b.email)) throw new Erro(409, 'Já existe um usuário com este e-mail.');
      const u: UsuarioAdmin = { uid: id(), email: b.email, nome: String(b.nome).trim(), perfil: b.perfil };
      usuariosDemo.push(u);
      return u;
    }
    if (m === 'PATCH' && p[2] === 'perfil') {
      if (!PERFIS_VALIDOS.includes(b.perfil)) throw new Erro(400, 'perfil: perfil inválido.');
      const u = usuariosDemo.find((x) => x.uid === p[1]);
      if (!u) throw new Erro(404, 'Usuário não encontrado.');
      u.perfil = b.perfil;
      return { uid: u.uid, perfil: u.perfil };
    }
  }

  throw new Erro(404, 'Rota não encontrada.');
}

export const demoBackendInterceptor: HttpInterceptorFn = (req, next): Observable<any> => {
  if (!environment.demo || !req.url.startsWith(environment.apiUrl)) return next(req);
  const token = req.headers.get('Authorization')?.replace('Bearer demo-', '') as Perfil | undefined;
  if (!token) return throwError(() => new HttpErrorResponse({ status: 401, error: { erro: 'Faça login.' }, url: req.url }));
  try {
    const body = clone(rota(req, token));
    return of(new HttpResponse({ status: 200, body })).pipe(delay(120));
  } catch (e) {
    const err = e instanceof Erro ? e : new Erro(500, String(e));
    return throwError(() => new HttpErrorResponse({ status: err.status, error: { erro: err.erro }, url: req.url })).pipe(delay(120));
  }
};
