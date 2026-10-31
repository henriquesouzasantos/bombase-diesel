import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { criarApp } from './app';
import { conectar } from './lib/db';
import { Cliente, Veiculo } from './models';

/**
 * Pontos de entrada do Firebase.
 * - api: Express em /api/** (o Hosting redireciona para cá; ver firebase.json)
 * - anonimizarLgpd: rotina mensal da RE01
 *
 * A string do MongoDB é um secret:  firebase functions:secrets:set MONGODB_URI
 */
const MONGODB_URI = defineSecret('MONGODB_URI');

setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

export const api = onRequest({ secrets: [MONGODB_URI], memory: '512MiB', timeoutSeconds: 30 }, criarApp());

/** RE01 (LGPD): anonimiza clientes sem atividade há mais de 5 anos (prazo fiscal). */
export const anonimizarLgpd = onSchedule({ schedule: '0 3 1 * *', timeZone: 'America/Sao_Paulo', secrets: [MONGODB_URI] }, async () => {
  await conectar();
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - 5);
  const alvos = await Cliente.find({ ultimaAtividadeEm: { $lt: limite }, anonimizadoEm: null }, { _id: 1 }).lean();
  for (const c of alvos) {
    const id = String(c._id).slice(-6);
    await Cliente.updateOne({ _id: c._id }, {
      $set: { nome: `Cliente anonimizado ${id}`, cpfCnpj: `ANON-${c._id}`, anonimizadoEm: new Date() },
      $unset: { telefone: 1, email: 1 },
    });
    await Veiculo.updateMany({ clienteId: c._id }, { $unset: { chassi: 1 } }).catch(() => undefined);
  }
  console.log(`LGPD: ${alvos.length} cliente(s) anonimizado(s).`);
});
