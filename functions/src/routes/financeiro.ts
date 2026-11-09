import { Router } from 'express';
import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import { z } from 'zod';
import { exigir } from '../lib/auth';
import { transacao } from '../lib/db';
import { HttpError, naoEncontrado, rota } from '../lib/http';
import { ContaBancaria, OrdemServico, TransacaoFinanceira } from '../models';
import { Natureza, calcularLiquidez, centavos, hashRegistro, naturezaDe, somarDiasUteis, valorEfetivo } from '../domain/regras';

/** Financeiro multi-bancário (Entrega 2: RF10–RF20, RN02, RN03). Só gerente financeiro e administrador. */
export const financeiro = Router();
financeiro.use(exigir('GERENTE_FINANCEIRO'));

type TransacaoDoc = InstanceType<typeof TransacaoFinanceira>;

const idValido = z.string().refine(Types.ObjectId.isValid, 'id inválido');
const dinheiro = z.coerce.number().min(0);
const MEIOS = ['PIX', 'BOLETO', 'CARTAO', 'TED', 'DINHEIRO'] as const;
type Meio = (typeof MEIOS)[number];

/** PIX e dinheiro caem na hora; o resto segue o prazo de compensação da conta (N+k dias úteis). */
const dataCompensacao = (natureza: Natureza, meio: Meio | undefined, efetivacao: Date, diasConta: number) =>
  natureza === 'SAIDA' || meio === 'PIX' || meio === 'DINHEIRO' ? efetivacao : somarDiasUteis(efetivacao, diasConta);

/** RNF02.2 / RN03: grava o hash do registro encadeado ao último hash gravado. */
async function selar(t: TransacaoDoc, session: ClientSession) {
  const ultimo = await TransacaoFinanceira.findOne({ hash: { $exists: true }, _id: { $ne: t._id } }, { hash: 1 })
    .sort({ atualizadoEm: -1 }).session(session).lean();
  t.hashAnterior = ultimo?.hash ?? '';
  t.hash = hashRegistro({
    id: String(t._id), tipo: t.tipo, natureza: t.natureza, status: t.status, contaId: t.contaId ? String(t.contaId) : null,
    valorBruto: t.valorBruto, valorLiquido: t.valorLiquido ?? null, dataEfetivacao: t.dataEfetivacao?.toISOString() ?? null,
  }, t.hashAnterior);
}

/** Junta nome da conta e número da OS para a tela. */
async function enriquecer(lista: Record<string, any>[]) {
  const contaIds = [...new Set(lista.map((t) => t['contaId']).filter(Boolean).map(String))];
  const osIds = [...new Set(lista.map((t) => t['osId']).filter(Boolean).map(String))];
  const [cs, os] = await Promise.all([
    ContaBancaria.find({ _id: { $in: contaIds } }, { nomeBanco: 1 }).lean(),
    OrdemServico.find({ _id: { $in: osIds } }, { numero: 1 }).lean(),
  ]);
  const cm = new Map(cs.map((c) => [String(c._id), c.nomeBanco]));
  const om = new Map(os.map((o) => [String(o._id), o.numero]));
  return lista.map((t) => ({ ...t, contaNome: t['contaId'] ? cm.get(String(t['contaId'])) : undefined, osNumero: t['osId'] ? om.get(String(t['osId'])) : undefined }));
}
const uma = async (t: TransacaoDoc) => (await enriquecer([t.toObject()]))[0];

/* ---------------- Contas bancárias (RF10–RF12) ---------------- */

const ContaIn = z.object({
  nomeBanco: z.string().trim().min(2),
  agencia: z.string().optional(),
  numeroConta: z.string().optional(),
  tipo: z.enum(['BANCO', 'CAIXA', 'PIX_PJ']),
  ativa: z.boolean().default(true),
  diasCompensacao: z.coerce.number().int().min(0).max(30).default(1),
  taxasPadrao: z.object({ boleto: dinheiro.default(0), cartaoPercentual: dinheiro.default(0), pixPercentual: dinheiro.default(0) }).default({}),
});

financeiro.get('/contas', rota(async () => ContaBancaria.find().sort({ ativa: -1, nomeBanco: 1 }).lean()));

financeiro.post('/contas', rota(async (req) => {
  const saldoInicial = z.coerce.number().default(0).parse(req.body?.saldoAtual);
  return ContaBancaria.create({ ...ContaIn.parse(req.body), saldoAtual: centavos(saldoInicial) });
}));

/** O saldo não é editável: só muda por lançamento (trilha de auditoria). */
financeiro.put('/contas/:id', rota(async (req) => {
  const c = naoEncontrado(await ContaBancaria.findById(req.params['id']), 'Conta');
  c.set(ContaIn.parse(req.body));
  await c.save();
  return c;
}));

/* ---------------- Lançamentos (RF13–RF15) ---------------- */

const Filtro = z.object({
  tipo: z.string().optional(),
  status: z.string().optional(),
  contaId: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
  campo: z.enum(['efetivacao', 'vencimento']).default('efetivacao'),
  busca: z.string().optional(),
});

/** RF18–RF20: extrato geral com filtros. */
financeiro.get('/transacoes', rota(async (req) => {
  const f = Filtro.parse(req.query);
  const q: Record<string, unknown> = {};
  if (f.tipo) q['tipo'] = { $in: f.tipo.split(',') };
  if (f.status) q['status'] = { $in: f.status.split(',') };
  if (f.contaId) q['contaId'] = idValido.parse(f.contaId);
  const campo = f.campo === 'vencimento' ? 'dataVencimento' : 'dataEfetivacao';
  if (f.de || f.ate) {
    const faixa: Record<string, Date> = {};
    if (f.de) faixa['$gte'] = new Date(f.de + 'T00:00:00');
    if (f.ate) faixa['$lte'] = new Date(f.ate + 'T23:59:59.999');
    q[campo] = faixa;
  }
  if (f.busca?.trim()) {
    const re = new RegExp(f.busca.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q['$or'] = [{ favorecido: re }, { descricao: re }];
  }
  return enriquecer(await TransacaoFinanceira.find(q).sort({ [campo]: -1, criadoEm: -1 }).limit(1000).lean());
}));

const NovoLancamento = z.object({
  tipo: z.enum(['RECEBER', 'PAGAR', 'AVULSO_ENTRADA', 'AVULSO_SAIDA']),
  descricao: z.string().trim().min(3),
  favorecido: z.string().trim().optional(),
  valorBruto: z.coerce.number().positive(),
  dataVencimento: z.coerce.date().optional(),
  contaId: idValido.optional(),
  meio: z.enum(MEIOS).optional(),
  taxaBancaria: dinheiro.default(0),
});

/** RF13: título a receber/pagar (fica pendente) ou lançamento avulso/PIX (liquida na hora). */
financeiro.post('/transacoes', rota(async (req) => {
  const d = NovoLancamento.parse(req.body);
  const natureza = naturezaDe(d.tipo);
  const usuario = req.usuario!.email;

  if (d.tipo === 'RECEBER' || d.tipo === 'PAGAR') {
    if (!d.dataVencimento) throw new HttpError(400, 'Informe o vencimento.');
    const t = await transacao(async (session) => {
      const [t] = await TransacaoFinanceira.create([{ ...d, natureza, status: 'PENDENTE', taxaBancaria: 0, usuario }], { session });
      await selar(t!, session);
      await t!.save({ session });
      return t!;
    });
    return uma(t);
  }

  if (!d.contaId) throw new HttpError(400, 'Escolha a conta do lançamento.');
  const t = await transacao(async (session) => {
    const conta = naoEncontrado(await ContaBancaria.findById(d.contaId).session(session), 'Conta');
    if (!conta.ativa) throw new HttpError(422, 'Esta conta está inativa.');
    const valor = valorEfetivo(natureza, d.valorBruto, 0, 0, d.taxaBancaria);
    if (valor <= 0) throw new HttpError(422, 'O valor líquido precisa ser maior que zero.');
    const agora = new Date();
    const [t] = await TransacaoFinanceira.create([{
      ...d, natureza, status: 'LIQUIDADO', valorLiquido: valor, dataEfetivacao: agora,
      dataCompensacao: dataCompensacao(natureza, d.meio, agora, conta.diasCompensacao ?? 1), usuario,
    }], { session });
    await ContaBancaria.updateOne({ _id: conta._id }, { $inc: { saldoAtual: natureza === 'ENTRADA' ? valor : -valor } }, { session });
    await selar(t!, session);
    await t!.save({ session });
    return t!;
  });
  return uma(t);
}));

const Liquidacao = z.object({
  contaId: idValido,
  meio: z.enum(MEIOS),
  dataEfetivacao: z.coerce.date().optional(),
  desconto: dinheiro.default(0),
  jurosMulta: dinheiro.default(0),
  taxaBancaria: dinheiro.default(0),
});

/** RF14/RF15 + RN02: liquidação com juros, descontos e taxas, atualizando o saldo na mesma transação. */
financeiro.post('/transacoes/:id/liquidar', rota(async (req) => {
  const d = Liquidacao.parse(req.body);
  const t = await transacao(async (session) => {
    const t = naoEncontrado(await TransacaoFinanceira.findById(req.params['id']).session(session), 'Lançamento');
    if (t.status !== 'PENDENTE') throw new HttpError(409, 'Este título já foi liquidado ou cancelado.');
    const conta = naoEncontrado(await ContaBancaria.findById(d.contaId).session(session), 'Conta');
    if (!conta.ativa) throw new HttpError(422, 'Esta conta está inativa.');
    const natureza = t.natureza as Natureza;
    const valor = valorEfetivo(natureza, t.valorBruto, d.desconto, d.jurosMulta, d.taxaBancaria);
    if (valor <= 0) throw new HttpError(422, 'O valor líquido precisa ser maior que zero.');
    const efetivacao = d.dataEfetivacao ?? new Date();
    t.set({
      contaId: conta._id, meio: d.meio, desconto: d.desconto, jurosMulta: d.jurosMulta, taxaBancaria: d.taxaBancaria,
      valorLiquido: valor, status: 'LIQUIDADO', dataEfetivacao: efetivacao,
      dataCompensacao: dataCompensacao(natureza, d.meio, efetivacao, conta.diasCompensacao ?? 1), usuario: req.usuario!.email,
    });
    await ContaBancaria.updateOne({ _id: conta._id }, { $inc: { saldoAtual: natureza === 'ENTRADA' ? valor : -valor } }, { session });
    await selar(t, session);
    await t.save({ session });
    return t;
  });
  return uma(t);
}));

/** RN03: nada é apagado. O estorno cria um lançamento inverso e cancela o original. */
financeiro.post('/transacoes/:id/estornar', rota(async (req) => {
  const t = await transacao(async (session) => {
    const orig = naoEncontrado(await TransacaoFinanceira.findById(req.params['id']).session(session), 'Lançamento');
    if (orig.status !== 'LIQUIDADO' && orig.status !== 'CONCILIADO') throw new HttpError(409, 'Só lançamentos liquidados podem ser estornados.');
    if (orig.tipo === 'ESTORNO') throw new HttpError(409, 'Um estorno não pode ser estornado.');
    const natureza: Natureza = orig.natureza === 'ENTRADA' ? 'SAIDA' : 'ENTRADA';
    const valor = orig.valorLiquido ?? 0;
    const agora = new Date();
    const [est] = await TransacaoFinanceira.create([{
      tipo: 'ESTORNO', natureza, status: 'LIQUIDADO', contaId: orig.contaId, osId: orig.osId, favorecido: orig.favorecido,
      descricao: `Estorno: ${orig.descricao ?? orig.tipo}`, valorBruto: valor, valorLiquido: valor,
      dataEfetivacao: agora, dataCompensacao: agora, estornoDe: orig._id, usuario: req.usuario!.email,
    }], { session });
    orig.status = 'CANCELADO';
    await ContaBancaria.updateOne({ _id: orig.contaId }, { $inc: { saldoAtual: natureza === 'ENTRADA' ? valor : -valor } }, { session });
    await selar(orig, session);
    await orig.save({ session });
    await selar(est!, session);
    await est!.save({ session });
    return est!;
  });
  return uma(t);
}));

/** Cancela um título que ainda não foi pago (não mexe em saldo). */
financeiro.post('/transacoes/:id/cancelar', rota(async (req) => {
  const t = await transacao(async (session) => {
    const t = naoEncontrado(await TransacaoFinanceira.findById(req.params['id']).session(session), 'Lançamento');
    if (t.status !== 'PENDENTE') throw new HttpError(409, 'Só títulos pendentes podem ser cancelados. Use o estorno.');
    t.status = 'CANCELADO';
    await selar(t, session);
    await t.save({ session });
    return t;
  });
  return uma(t);
}));

/** Marca o lançamento como conferido com o extrato do banco. */
financeiro.post('/transacoes/:id/conciliar', rota(async (req) => {
  const t = await transacao(async (session) => {
    const t = naoEncontrado(await TransacaoFinanceira.findById(req.params['id']).session(session), 'Lançamento');
    if (t.status !== 'LIQUIDADO') throw new HttpError(409, 'Só lançamentos liquidados podem ser conciliados.');
    t.status = 'CONCILIADO';
    await selar(t, session);
    await t.save({ session });
    return t;
  });
  return uma(t);
}));

/* ---------------- Liquidez D+1 (RF16, RF17) ---------------- */

financeiro.get('/liquidez', rota(async () => {
  const agora = new Date();
  const [contas, transacoes] = await Promise.all([
    ContaBancaria.find({}, { nomeBanco: 1, saldoAtual: 1, ativa: 1 }).lean(),
    TransacaoFinanceira.find({
      $or: [
        { status: 'PENDENTE', dataVencimento: { $ne: null } },
        { status: { $in: ['LIQUIDADO', 'CONCILIADO'] }, natureza: 'ENTRADA', dataCompensacao: { $gt: agora } },
      ],
    }).lean(),
  ]);
  return calcularLiquidez(
    contas.map((c) => ({ _id: String(c._id), nomeBanco: c.nomeBanco, saldoAtual: c.saldoAtual ?? 0, ativa: c.ativa ?? true })),
    transacoes.map((t) => ({ ...t, natureza: t.natureza as Natureza, contaId: t.contaId ? String(t.contaId) : null })),
    agora,
  );
}));
