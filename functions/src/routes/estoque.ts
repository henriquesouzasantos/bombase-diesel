import { Router } from 'express';
import { z } from 'zod';
import { exigir } from '../lib/auth';
import { transacao } from '../lib/db';
import { HttpError, naoEncontrado, rota } from '../lib/http';
import { MovimentoEstoque, Peca } from '../models';
import { precoVenda } from '../domain/regras';

/* ---------- Peças (RF04, RF05) ---------- */

const PecaIn = z.object({
  sku: z.string().min(2),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  custo: z.coerce.number().min(0),
  margem: z.coerce.number().min(0),
  estoqueMinimo: z.coerce.number().min(0).default(0),
  localizacao: z.string().optional(),
  saldo: z.coerce.number().min(0).optional(),
});

export const pecas = Router();

pecas.get('/', rota(async (req) => {
  const b = String(req.query['busca'] ?? '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filtro = b ? { $or: [{ sku: new RegExp(b, 'i') }, { descricao: new RegExp(b, 'i') }] } : {};
  return Peca.find(filtro).sort({ sku: 1 }).limit(500).lean();
}));

pecas.post('/', exigir('RECEPCAO'), rota(async (req) => {
  const d = PecaIn.parse(req.body);
  return Peca.create({ ...d, saldo: d.saldo ?? 0, precoVenda: precoVenda(d.custo, d.margem) });
}));

/** O saldo não é editável aqui: só muda por entrada (NF-e) ou baixa de OS, sempre com movimento registrado. */
pecas.put('/:id', exigir('RECEPCAO'), rota(async (req) => {
  const { saldo: _ignorado, ...d } = PecaIn.parse(req.body);
  return naoEncontrado(await Peca.findByIdAndUpdate(req.params['id'], { ...d, precoVenda: precoVenda(d.custo, d.margem) }, { new: true, runValidators: true }), 'Peça');
}));

/** RF06: entrada de estoque (NF-e) atômica: saldo + movimento. */
pecas.post('/:id/entrada', exigir('RECEPCAO'), rota(async (req) => {
  const { quantidade, documento } = z.object({ quantidade: z.coerce.number().positive(), documento: z.string().optional() }).parse(req.body);
  return transacao(async (session) => {
    const p = await Peca.findByIdAndUpdate(req.params['id'], { $inc: { saldo: quantidade } }, { new: true, session });
    if (!p) throw new HttpError(404, 'Peça não encontrada.');
    await MovimentoEstoque.create([{ pecaId: p._id, tipo: 'ENTRADA', quantidade, documento, usuario: req.usuario!.email }], { session });
    return p;
  });
}));
