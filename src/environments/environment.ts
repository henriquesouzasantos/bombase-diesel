/**
 * Ambiente de desenvolvimento.
 *
 * demo: true  → o app roda sem Firebase nem MongoDB, com dados de exemplo em memória
 *               (bom para apresentar e para desenvolver as telas).
 * demo: false → usa Firebase Auth + a API (Cloud Functions + MongoDB).
 *
 * Os valores de `firebase` vêm do Console do Firebase:
 * Configurações do projeto → Seus apps → App da Web → Configuração do SDK.
 * Eles não são segredos (ficam no navegador), mas não coloque aqui a string do MongoDB.
 */
export const environment = {
  production: false,
  demo: true,
  apiUrl: '/api',
  firebase: {
    apiKey: 'COLE_AQUI',
    authDomain: 'SEU-PROJETO.firebaseapp.com',
    projectId: 'SEU-PROJETO',
    appId: 'COLE_AQUI',
  },
};
