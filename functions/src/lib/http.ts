import type { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

/** Erro de regra de negócio com status HTTP. A mensagem vai para o usuário. */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Permite usar async/await nas rotas sem try/catch repetido. */
export const rota = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res).then((body) => { if (!res.headersSent) res.json(body); }).catch(next); };

/** Converte qualquer erro em { erro: "mensagem" } com o status certo. */
export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err instanceof ZodError) return res.status(400).json({ erro: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ erro: 'Registro não encontrado.' });
  if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ erro: Object.values(err.errors).map((e) => e.message).join('; ') });
  if ((err as { code?: number })?.code === 11000) {
    const campo = Object.keys((err as { keyPattern?: object }).keyPattern ?? {})[0] ?? 'campo';
    return res.status(409).json({ erro: `Já existe um registro com este ${campo}.` });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno. Tente de novo em instantes.' });
}

export function naoEncontrado<T>(doc: T, nome: string): NonNullable<T> {
  if (doc === null || doc === undefined) throw new HttpError(404, `${nome} não encontrado(a).`);
  return doc;
}
