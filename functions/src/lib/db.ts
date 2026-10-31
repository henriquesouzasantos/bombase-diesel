import mongoose from 'mongoose';

let conexao: Promise<typeof mongoose> | null = null;

/**
 * Conecta ao MongoDB uma única vez por instância da função (a conexão é reaproveitada
 * entre requisições). A string vem do secret/variável MONGODB_URI.
 *
 * Transações (RNF01/RNF02.3) exigem replica set: o MongoDB Atlas já é um replica set.
 */
export function conectar() {
  if (!conexao) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI não configurada. Veja functions/.env.example.');
    mongoose.set('strictQuery', true);
    conexao = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 }).catch((e) => {
      conexao = null;
      throw e;
    });
  }
  return conexao;
}

/** Executa `fn` dentro de uma transação ACID (BEGIN … COMMIT, com ROLLBACK em erro). */
export async function transacao<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let resultado!: T;
    await session.withTransaction(async () => { resultado = await fn(session); });
    return resultado;
  } finally {
    await session.endSession();
  }
}
