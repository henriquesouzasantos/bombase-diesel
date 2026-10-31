import { Router } from 'express';
import { rota } from '../lib/http';
import { Cliente, OrdemServico, Peca, STATUS_OS, Veiculo } from '../models';

export const painel = Router();

painel.get('/', rota(async () => {
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const [porStatus, abaixo, clientes, veiculos, faturado, ultimas] = await Promise.all([
    OrdemServico.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Peca.find({ $expr: { $lt: ['$saldo', '$estoqueMinimo'] } }).limit(20).lean(),
    Cliente.countDocuments({ anonimizadoEm: null }),
    Veiculo.countDocuments(),
    OrdemServico.aggregate<{ total: number }>([{ $match: { faturadaEm: { $gte: inicioMes } } }, { $group: { _id: null, total: { $sum: '$valorTotal' } } }]),
    OrdemServico.find().sort({ numero: -1 }).limit(5).lean(),
  ]);
  const osPorStatus = Object.fromEntries(STATUS_OS.map((s) => [s, porStatus.find((x) => x._id === s)?.n ?? 0]));
  const vs = new Map((await Veiculo.find({ _id: { $in: ultimas.map((o) => o.veiculoId) } }).lean()).map((v) => [String(v._id), `${v.marca} ${v.modelo} · ${v.placa}`]));
  const cs = new Map((await Cliente.find({ _id: { $in: ultimas.map((o) => o.clienteId) } }, { nome: 1 }).lean()).map((c) => [String(c._id), c.nome]));
  return {
    osAbertas: STATUS_OS.filter((s) => s !== 'FATURADO').reduce((t, s) => t + osPorStatus[s], 0),
    osPorStatus,
    pecasAbaixoMinimo: abaixo,
    clientes,
    veiculos,
    faturadoMes: faturado[0]?.total ?? 0,
    ultimasOS: ultimas.map((o) => ({ ...o, veiculoDescricao: vs.get(String(o.veiculoId)), clienteNome: cs.get(String(o.clienteId)) })),
  };
}));
