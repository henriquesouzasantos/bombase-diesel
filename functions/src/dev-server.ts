/**
 * Servidor local da API sem emuladores do Firebase:  npm run dev  (lê functions/.env)
 * Com AUTH_DEMO=true aceita o token "demo-ADMIN", "demo-RECEPCAO", "demo-TECNICO"...
 */
import { criarApp } from './app';

const porta = Number(process.env.PORT ?? 5001);
criarApp().listen(porta, () => console.log(`API em http://localhost:${porta}/api`));
