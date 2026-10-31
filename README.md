# Bombase Diesel · ERP

Sistema integrado de gestão para oficina de injeção diesel (ERP / CRM / Financeiro).
Projeto da disciplina ECOT11A – Engenharia de Software (UNIFEI).

| Camada | Tecnologia |
| --- | --- |
| Telas | Angular 19 + TypeScript + Tailwind CSS |
| Login e perfis | Firebase Authentication (perfil no *custom claim* `perfil`) |
| API | Firebase Cloud Functions (Express) |
| Banco de dados | MongoDB Atlas (Mongoose) |
| Hospedagem | Firebase Hosting |
| Versionamento | Git + GitHub (CI em `.github/workflows/ci.yml`) |

## O que já funciona (Entrega 1)

- Página inicial com o raio-x do caminhão (animações guiadas pela rolagem)
- Login com perfis: Administrador, Gerente financeiro, Recepção e Técnico de pátio (RNF02)
- Painel com indicadores e alertas de estoque mínimo
- Clientes PF/PJ com consentimento LGPD (RF01, RE01)
- Veículos por placa e chassi, com histórico de manutenção (RF02, RF03)
- Estoque de peças com custo, margem, preço de venda e entrada por NF-e (RF04–RF06)
- Quadro de OS com arrastar e soltar, respeitando o diagrama de estados (RF07)
- Detalhe da OS: peças, baixa física no estoque e apontamento de horas (RF08)
- Trava RN01: a OS não conclui nem fatura com peça sem baixa física
- Baixas de estoque em transação ACID no MongoDB (RNF01)
- Rotina mensal de anonimização LGPD (RE01)

Planejado para a Entrega 2: financeiro multi-bancário, liquidação RN02, liquidez D+1 e extrato. Os modelos `ContaBancaria` e `TransacaoFinanceira` e as funções `valorLiquido` e `hashRegistro` já estão prontos em `functions/src`.

## Estrutura

```
├── src/                     Angular (telas)
│   ├── app/core/            autenticação, API, modelos, backend de demonstração
│   ├── app/layout/          menu lateral e cabeçalho
│   ├── app/pages/           landing, login, painel, clientes, veículos, estoque, os
│   └── environments/        configuração (modo demo, chaves do Firebase)
├── functions/               API (Cloud Functions + MongoDB)
│   ├── src/models/          coleções do MongoDB
│   ├── src/domain/          regras de negócio puras + testes
│   ├── src/routes/          rotas REST /api/...
│   └── scripts/             seed de dados e definição de perfil
├── firebase.json            Hosting + Functions
└── .github/workflows/ci.yml compila e testa a cada push
```

## 1. Rodar agora, sem configurar nada (modo demonstração)

Precisa do [Node.js 22](https://nodejs.org).

```bash
npm install
npm start
```

Abra http://localhost:4200. Com `demo: true` em `src/environments/environment.ts`, o app usa dados de exemplo na memória e qualquer e-mail entra. É o modo para apresentar e para desenvolver telas.

## 2. Subir para o GitHub

1. Crie uma conta em https://github.com e um repositório **vazio** chamado `bombase-diesel` (sem README, sem .gitignore).
2. Instale o Git: https://git-scm.com/downloads
3. Na pasta do projeto, rode:

```bash
git init
git add .
git commit -m "Estrutura inicial do ERP Bombase Diesel"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/bombase-diesel.git
git push -u origin main
```

Na primeira vez o Git pede login no GitHub (abre o navegador).

O `.gitignore` já impede que `node_modules`, `.env` e chaves de conta de serviço sejam enviados. **Nunca** suba a string do MongoDB.

### Trabalho em equipe (5 pessoas)

- `main`: versão estável, protegida (Settings → Branches → exigir pull request)
- `develop`: integração da sprint
- Uma branch por tarefa do Redmine: `feature/104-fluxo-os`, `fix/estoque-saldo`

```bash
git checkout develop
git pull
git checkout -b feature/106-contas-bancarias
# ...trabalha...
git add .
git commit -m "#106 cadastro de contas bancárias"
git push -u origin feature/106-contas-bancarias
```

Depois abra um Pull Request para `develop` no GitHub. O CI roda sozinho e o QA revisa antes do merge.

## 3. Ligar o banco e o login de verdade

### MongoDB Atlas
1. Crie um cluster gratuito (M0) em https://www.mongodb.com/atlas
2. Database Access → crie um usuário. Network Access → libere `0.0.0.0/0` (necessário para o Cloud Functions).
3. Connect → Drivers → copie a string `mongodb+srv://...`
4. Copie `functions/.env.example` para `functions/.env` e cole a string em `MONGODB_URI`.
5. Dados de exemplo: `cd functions && npm install && npm run seed`

### Firebase
1. Crie um projeto em https://console.firebase.google.com (plano Blaze é exigido para Cloud Functions; o uso de uma turma cabe na cota gratuita).
2. Authentication → ative **E-mail/senha** e crie o primeiro usuário.
3. Configurações do projeto → Seus apps → Web → copie a configuração para `src/environments/environment*.ts` e mude `demo` para `false`.
4. Coloque o id do projeto em `.firebaserc`.
5. Torne o primeiro usuário administrador (precisa de uma chave de conta de serviço, guardada **fora** da pasta do projeto):

```powershell
# Windows (PowerShell)
cd functions
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\chaves\bombase.json"
npm run set-perfil -- voce@bombase.com.br ADMIN
```

```bash
# macOS / Linux
cd functions
GOOGLE_APPLICATION_CREDENTIALS=~/chaves/bombase.json npm run set-perfil -- voce@bombase.com.br ADMIN
```

### Rodar tudo localmente

```bash
# terminal 1: API em http://localhost:5001/api (lê functions/.env)
cd functions && npm run dev

# terminal 2: telas em http://localhost:4200 (o /api é redirecionado para a porta 5001)
npm start
```

Para testar a API sem Firebase, use `AUTH_DEMO=true` no `functions/.env` e `demo: false` no front: a API aceita tokens `demo-ADMIN`, `demo-RECEPCAO` etc. Isso só funciona fora da nuvem.

### Publicar

```bash
npm install -g firebase-tools
firebase login
cd functions && firebase functions:secrets:set MONGODB_URI   # cola a string do Atlas
cd .. && npm run deploy
```

## Testes

```bash
cd functions && npm test     # regras RN01, RN02, juros/multa, transições de status, hash
```

As transações do MongoDB exigem replica set. O Atlas já é um replica set; um `mongod` local simples não serve.

## Rotas da API

| Método | Rota | Perfis |
| --- | --- | --- |
| GET | `/api/painel` | todos |
| GET/POST/PUT | `/api/clientes` | leitura: todos · escrita: Recepção |
| GET/POST/PUT | `/api/veiculos`, `/api/veiculos/:id/historico` | leitura: todos · escrita: Recepção |
| GET/POST/PUT | `/api/pecas`, `POST /api/pecas/:id/entrada` | leitura: todos · escrita: Recepção |
| GET/POST | `/api/os` | abrir: Recepção |
| PATCH | `/api/os/:id/status` | operar: Recepção, Técnico · concluir/faturar: Recepção, Gerente financeiro |
| POST | `/api/os/:id/itens`, `/itens/:itemId/baixa`, `/apontamentos` | Recepção, Técnico |
| GET/POST/PATCH | `/api/usuarios` | Administrador |

O Administrador pode tudo.
