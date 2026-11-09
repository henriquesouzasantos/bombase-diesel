import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { exigir } from '../lib/auth';
import { transacao } from '../lib/db';
import { HttpError, naoEncontrado, rota } from '../lib/http';
import { Cliente, Contador, MovimentoEstoque, OrdemServico, Peca, STATUS_OS, TransacaoFinanceira, Veiculo } from '../models';
import { StatusOS, hashRegistro, horasEntre, podeMudar, prazoDias, totalOS } from '../domain/regras';

export const os = Router();

type OSDoc = InstanceType<typeof OrdemServico>;

/** Junta nome do cliente e descrição do veículo para a tela. */
async function enriquecer(lista: Record<string, any>[]) {
  const vIds = [...new Set(lista.map((o) => String(o['veiculoId'])))];
  const cIds = [...new Set(lista.map((o) => String(o['clienteId'])))];
  const [vs, cs] = await Promise.all([Veiculo.find({ _id: { $in: vIds } }).lean(), Cliente.find({ _id: { $in: cIds } }, { nome: 1 }).lean()]);
  const vm = new Map(vs.map((v) => [String(v._id), `${v.marca} ${v.modelo} · ${v.placa}`]));
  const cm = new Map(cs.map((c) => [String(c._id), c.nome]));
  return lista.map((o) => ({ ...o, veiculoDescricao: vm.get(String(o['veiculoId'])), clienteNome: cm.get(String(o['clienteId'])) }));
}
const um = async (o: OSDoc | null) => (await enriquecer([naoEncontrado(o, 'OS').toObject()]))[0];

function exigirEditavel(o: OSDoc) {
  if (o.status === 'CONCLUIDO' || o.status === 'FATURADO') throw new HttpError(422, 'OS concluída não pode ser alterada.');
}

os.get('/', rota(async (req) => {
  const filtro = req.query['status'] ? { status: req.query['status'] } : {};
  return enriquecer(await OrdemServico.find(filtro).sort({ numero: -1 }).limit(300).lean());
}));

os.get('/:id', rota(async (req) => um(await OrdemServico.findById(req.params['id']))));

/** Abertura de OS (recepção). */
os.post('/', exigir('RECEPCAO'), rota(async (req) => {
  const { veiculoId, descricao } = z.object({ veiculoId: z.string().refine(Types.ObjectId.isValid, 'veículo inválido'), descricao: z.string().min(3) }).parse(req.body);
  const v = naoEncontrado(await Veiculo.findById(veiculoId), 'Veículo');
  const seq = await Contador.findByIdAndUpdate('os', { $inc: { valor: 1 } }, { new: true, upsert: true });
  const numero = 1000 + (seq!.valor ?? 1);
  const o = await OrdemServico.create({
    numero, veiculoId: v._id, clienteId: v.clienteId, descricao, status: 'ABERTO',
    historico: [{ status: 'ABERTO', por: req.usuario!.nome }],
  });
  await Cliente.updateOne({ _id: v.clienteId }, { ultimaAtividadeEm: new Date() });
  return um(o);
}));

/** RF07: mudança de status, respeitando o diagrama de estados e a RN01. */
os.patch('/:id/status', rota(async (req) => {
  const { status } = z.object({ status: z.enum(STATUS_OS) }).parse(req.body);
  const o = naoEncontrado(await OrdemServico.findById(req.params['id']), 'OS');
  if (!podeMudar(o.status as StatusOS, status)) throw new HttpError(422, 'Esta mudança de status não é permitida.');

  const perfil = req.usuario!.perfil;
  const fechando = status === 'CONCLUIDO' || status === 'FATURADO';
  const permitidos = fechando ? ['ADMIN', 'RECEPCAO', 'GERENTE_FINANCEIRO'] : ['ADMIN', 'RECEPCAO', 'TECNICO'];
  if (!permitidos.includes(perfil)) throw new HttpError(403, 'Seu perfil não tem permissão para esta ação.');

  if (fechando) {
    const pend = o.itens.filter((i) => !i.baixado); // RN01
    if (pend.length) throw new HttpError(422, `RN01: ${pend.length} peça(s) sem baixa física no estoque (${pend.map((i) => i.sku).join(', ')}).`);
  }
  o.status = status;
  if (status === 'EM_ANDAMENTO' && !o.tecnico && perfil === 'TECNICO') o.tecnico = req.usuario!.nome;
  if (status === 'CONCLUIDO') o.concluidaEm = new Date();
  o.historico.push({ status, por: req.usuario!.nome });
  if (status !== 'FATURADO') {
    await o.save();
    return um(o);
  }

  // RF09: faturar cria o título a receber do cliente na mesma transação.
  o.faturadaEm = new Date();
  o.valorTotal = totalOS(o).total;
  if (!o.valorTotal) {
    await o.save();
    return um(o);
  }
  await transacao(async (session) => {
    const cliente = await Cliente.findById(o.clienteId, { nome: 1, condicoesPagamento: 1 }).session(session).lean();
    const venc = new Date(o.faturadaEm!);
    venc.setDate(venc.getDate() + prazoDias(cliente?.condicoesPagamento));
    const [t] = await TransacaoFinanceira.create([{
      tipo: 'RECEBER', natureza: 'ENTRADA', status: 'PENDENTE', osId: o._id, favorecido: cliente?.nome,
      descricao: o.descricao, valorBruto: o.valorTotal, dataVencimento: venc, usuario: req.usuario!.email,
    }], { session });
    const ultimo = await TransacaoFinanceira.findOne({ hash: { $exists: true }, _id: { $ne: t!._id } }, { hash: 1 }).sort({ atualizadoEm: -1 }).session(session).lean();
    t!.hashAnterior = ultimo?.hash ?? '';
    t!.hash = hashRegistro({ id: String(t!._id), tipo: t!.tipo, natureza: t!.natureza, status: t!.status, contaId: null, valorBruto: t!.valorBruto, valorLiquido: null, dataEfetivacao: null }, t!.hashAnterior);
    await t!.save({ session });
    await o.save({ session });
  });
  return um(o);
}));

/** RF08: requisição de peça para a OS (ainda sem baixa). */
os.post('/:id/itens', exigir('RECEPCAO', 'TECNICO'), rota(async (req) => {
  const { pecaId, quantidade } = z.object({ pecaId: z.string().refine(Types.ObjectId.isValid), quantidade: z.coerce.number().int().positive() }).parse(req.body);
  const o = naoEncontrado(await OrdemServico.findById(req.params['id']), 'OS');
  exigirEditavel(o);
  const p = naoEncontrado(await Peca.findById(pecaId), 'Peça');
  o.itens.push({ pecaId: p._id, sku: p.sku, descricao: p.descricao, quantidade, precoUnitario: p.precoVenda, baixado: false });
  await o.save();
  return um(o);
}));

/** RF05 + RNF01: baixa física atômica. O saldo só cai se houver quantidade suficiente. */
os.post('/:id/itens/:itemId/baixa', exigir('RECEPCAO', 'TECNICO'), rota(async (req) => {
  const o = await transacao(async (session) => {
    const o = naoEncontrado(await OrdemServico.findById(req.params['id']).session(session), 'OS');
    exigirEditavel(o);
    const item = o.itens.id(req.params['itemId']);
    if (!item) throw new HttpError(404, 'Item não encontrado.');
    if (item.baixado) throw new HttpError(409, 'Este item já teve baixa.');
    const p = await Peca.findOneAndUpdate(
      { _id: item.pecaId, saldo: { $gte: item.quantidade } },
      { $inc: { saldo: -item.quantidade } },
      { new: true, session },
    );
    if (!p) {
      const atual = await Peca.findById(item.pecaId).session(session);
      throw new HttpError(422, `Saldo insuficiente de ${item.sku}: ${atual?.saldo ?? 0} ${atual?.unidade ?? ''} em estoque.`);
    }
    await MovimentoEstoque.create([{ pecaId: p._id, tipo: 'SAIDA', quantidade: item.quantidade, osId: o._id, usuario: req.usuario!.email }], { session });
    item.baixado = true;
    await o.save({ session });
    return o;
  });
  return um(o);
}));

/** RF08: apontamento de horas do técnico. */
os.post('/:id/apontamentos', exigir('RECEPCAO', 'TECNICO'), rota(async (req) => {
  const hora = z.string().regex(/^\d{2}:\d{2}$/);
  const d = z.object({ tecnico: z.string().min(2), inicio: hora, fim: hora, valorHora: z.coerce.number().min(0) }).parse(req.body);
  const horas = horasEntre(d.inicio, d.fim);
  if (horas <= 0) throw new HttpError(400, 'O fim precisa ser depois do início.');
  const o = naoEncontrado(await OrdemServico.findById(req.params['id']), 'OS');
  exigirEditavel(o);
  o.apontamentos.push({ ...d, horas, tecnicoUid: req.usuario!.uid });
  if (!o.tecnico) o.tecnico = d.tecnico;
  await o.save();
  return um(o);
}));
