import cors from 'cors';
import express from 'express';
import { autenticar } from './lib/auth';
import { conectar } from './lib/db';
import { tratarErros } from './lib/http';
import { clientes, veiculos } from './routes/cadastros';
import { pecas } from './routes/estoque';
import { os } from './routes/os';
import { painel } from './routes/painel';
import { usuarios } from './routes/usuarios';

/** API REST. Todas as rotas ficam em /api e exigem login. */
export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  api.get('/saude', (_req, res) => { res.json({ ok: true }); });
  api.use(async (_req, _res, next) => { try { await conectar(); next(); } catch (e) { next(e); } });
  api.use(autenticar);
  api.use('/painel', painel);
  api.use('/clientes', clientes);
  api.use('/veiculos', veiculos);
  api.use('/pecas', pecas);
  api.use('/os', os);
  api.use('/usuarios', usuarios);
  api.use((_req, res) => { res.status(404).json({ erro: 'Rota não encontrada.' }); });

  app.use('/api', api);
  app.use(tratarErros);
  return app;
}
