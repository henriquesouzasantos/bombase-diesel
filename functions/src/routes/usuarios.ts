import { Router } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import { PERFIS, exigir } from '../lib/auth';
import { rota } from '../lib/http';

/** RNF02: gestão de perfis. Só o administrador acessa. */
export const usuarios = Router();
usuarios.use(exigir());

usuarios.get('/', rota(async () => {
  const { users } = await getAuth().listUsers(1000);
  return users.map((u) => ({ uid: u.uid, email: u.email, nome: u.displayName ?? u.email, perfil: u.customClaims?.['perfil'] ?? null, desativado: u.disabled }));
}));

usuarios.post('/', rota(async (req) => {
  const d = z.object({ email: z.string().email(), nome: z.string().min(2), senha: z.string().min(8), perfil: z.enum(PERFIS as [string, ...string[]]) }).parse(req.body);
  const u = await getAuth().createUser({ email: d.email, password: d.senha, displayName: d.nome });
  await getAuth().setCustomUserClaims(u.uid, { perfil: d.perfil });
  return { uid: u.uid, email: u.email, nome: d.nome, perfil: d.perfil };
}));

usuarios.patch('/:uid/perfil', rota(async (req) => {
  const { perfil } = z.object({ perfil: z.enum(PERFIS as [string, ...string[]]) }).parse(req.body);
  await getAuth().setCustomUserClaims(req.params['uid']!, { perfil });
  return { uid: req.params['uid'], perfil };
}));
