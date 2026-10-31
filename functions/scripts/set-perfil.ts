/**
 * Define o perfil (RBAC) de um usuário do Firebase Auth. Use para criar o primeiro ADMIN.
 *   1. Crie o usuário no Console do Firebase → Authentication → Adicionar usuário
 *   2. Baixe uma chave de conta de serviço (Configurações → Contas de serviço) FORA da pasta do projeto
 *   3. GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave.json npm run set-perfil -- email@bombase.com.br ADMIN
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, perfil] = process.argv.slice(2);
const validos = ['ADMIN', 'GERENTE_FINANCEIRO', 'RECEPCAO', 'TECNICO'];

async function main() {
  if (!email || !validos.includes(perfil ?? '')) {
    console.error(`Uso: npm run set-perfil -- <email> <${validos.join('|')}>`);
    process.exit(1);
  }
  initializeApp();
  const u = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(u.uid, { perfil });
  console.log(`${email} agora é ${perfil}. Peça para a pessoa sair e entrar de novo.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
