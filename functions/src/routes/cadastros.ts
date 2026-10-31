import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { exigir } from '../lib/auth';
import { HttpError, naoEncontrado, rota } from '../lib/http';
import { Cliente, OrdemServico, Veiculo } from '../models';

const busca = (q: unknown) => String(q ?? '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------- Clientes (RF01) ---------- */

const ClienteIn = z.object({
  tipo: z.enum(['PF', 'PJ']),
  nome: z.string().min(2),
  cpfCnpj: z.string().min(11),
  telefone: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  limiteCredito: z.coerce.number().min(0).default(0),
  condicoesPagamento: z.string().optional(),
  consentimentoLgpdEm: z.coerce.date().optional(),
});

export const clientes = Router();

clientes.get('/', rota(async (req) => {
  const b = busca(req.query['busca']);
  const filtro = b ? { $or: [{ nome: new RegExp(b, 'i') }, { cpfCnpj: new RegExp(b, 'i') }], anonimizadoEm: null } : { anonimizadoEm: null };
  return Cliente.find(filtro).sort({ nome: 1 }).limit(200).lean();
}));

clientes.get('/:id', rota(async (req) => naoEncontrado(await Cliente.findById(req.params['id']).lean(), 'Cliente')));

clientes.post('/', exigir('RECEPCAO'), rota(async (req) => Cliente.create(ClienteIn.parse(req.body))));

clientes.put('/:id', exigir('RECEPCAO'), rota(async (req) =>
  naoEncontrado(await Cliente.findByIdAndUpdate(req.params['id'], ClienteIn.parse(req.body), { new: true, runValidators: true }), 'Cliente')));

/* ---------- Veículos (RF02, RF03) ---------- */

const VeiculoIn = z.object({
  clienteId: z.string().refine(Types.ObjectId.isValid, 'cliente inválido'),
  placa: z.string().min(7),
  chassi: z.string().min(11).max(17),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  ano: z.coerce.number().int().min(1950).max(2100).optional(),
  motor: z.string().optional(),
  hodometro: z.coerce.number().min(0).optional(),
  horimetro: z.coerce.number().min(0).optional(),
});

export const veiculos = Router();

async function comNomeCliente<T extends { clienteId: unknown }>(lista: T[]) {
  const ids = [...new Set(lista.map((v) => String(v.clienteId)))];
  const nomes = new Map((await Cliente.find({ _id: { $in: ids } }, { nome: 1 }).lean()).map((c) => [String(c._id), c.nome]));
  return lista.map((v) => ({ ...v, clienteNome: nomes.get(String(v.clienteId)) }));
}

veiculos.get('/', rota(async (req) => {
  const b = busca(req.query['busca']);
  let filtro = {};
  if (b) {
    const re = new RegExp(b, 'i');
    const donos = await Cliente.find({ nome: re }, { _id: 1 }).lean();
    filtro = { $or: [{ placa: re }, { chassi: re }, { modelo: re }, { clienteId: { $in: donos.map((d) => d._id) } }] };
  }
  return comNomeCliente(await Veiculo.find(filtro).sort({ placa: 1 }).limit(200).lean());
}));

veiculos.get('/:id', rota(async (req) => (await comNomeCliente([naoEncontrado(await Veiculo.findById(req.params['id']).lean(), 'Veículo')]))[0]));

veiculos.get('/:id/historico', rota(async (req) => OrdemServico.find({ veiculoId: req.params['id'] }).sort({ numero: -1 }).lean()));

veiculos.post('/', exigir('RECEPCAO'), rota(async (req) => {
  const dados = VeiculoIn.parse(req.body);
  naoEncontrado(await Cliente.exists({ _id: dados.clienteId }), 'Cliente');
  return Veiculo.create(dados);
}));

veiculos.put('/:id', exigir('RECEPCAO'), rota(async (req) => {
  const dados = VeiculoIn.parse(req.body);
  if (!(await Cliente.exists({ _id: dados.clienteId }))) throw new HttpError(400, 'Cliente não existe.');
  return naoEncontrado(await Veiculo.findByIdAndUpdate(req.params['id'], dados, { new: true, runValidators: true }), 'Veículo');
}));
