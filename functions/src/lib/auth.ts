import type { NextFunction, Request, Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { HttpError } from './http';

export type Perfil = 'ADMIN' | 'GERENTE_FINANCEIRO' | 'RECEPCAO' | 'TECNICO';
export const PERFIS: Perfil[] = ['ADMIN', 'GERENTE_FINANCEIRO', 'RECEPCAO', 'TECNICO'];

export interface UsuarioReq { uid: string; email: string; nome: string; perfil: Perfil }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { usuario?: UsuarioReq } }
}

if (!getApps().length) initializeApp();

/** Tokens "demo-PERFIL" só valem com AUTH_DEMO=true e fora da nuvem (K_SERVICE ausente). */
const demoPermitido = () => process.env.AUTH_DEMO === 'true' && !process.env.K_SERVICE;

/** RNF01.2: valida o JWT do Firebase em toda requisição. */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) throw new HttpError(401, 'Faça login para continuar.');
    if (demoPermitido() && token.startsWith('demo-')) {
      const perfil = token.slice(5) as Perfil;
      if (!PERFIS.includes(perfil)) throw new HttpError(401, 'Token de demonstração inválido.');
      req.usuario = { uid: token, email: `${perfil.toLowerCase()}@demo`, nome: perfil, perfil };
      return next();
    }
    const dec = await getAuth().verifyIdToken(token);
    req.usuario = {
      uid: dec.uid,
      email: dec.email ?? '',
      nome: (dec['name'] as string) ?? dec.email ?? dec.uid,
      perfil: (dec['perfil'] as Perfil) ?? 'TECNICO',
    };
    next();
  } catch (e) {
    next(e instanceof HttpError ? e : new HttpError(401, 'Sessão expirada. Entre de novo.'));
  }
}

/** RNF02: libera a rota só para os perfis listados (ADMIN sempre pode). */
export const exigir = (...perfis: Perfil[]) => (req: Request, _res: Response, next: NextFunction) => {
  const p = req.usuario?.perfil;
  if (p === 'ADMIN' || (p && perfis.includes(p))) return next();
  next(new HttpError(403, 'Seu perfil não tem permissão para esta ação.'));
};
