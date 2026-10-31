import { Routes } from '@angular/router';
import { authGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing/landing.component').then((m) => m.LandingComponent), title: 'Bombase Diesel' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent), title: 'Entrar · Bombase' },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'painel' },
      { path: 'painel', loadComponent: () => import('./pages/painel/painel.component').then((m) => m.PainelComponent), title: 'Painel · Bombase' },
      { path: 'clientes', loadComponent: () => import('./pages/clientes/clientes.component').then((m) => m.ClientesComponent), title: 'Clientes · Bombase' },
      { path: 'veiculos', loadComponent: () => import('./pages/veiculos/veiculos.component').then((m) => m.VeiculosComponent), title: 'Veículos · Bombase' },
      { path: 'veiculos/:id', loadComponent: () => import('./pages/veiculos/veiculo-historico.component').then((m) => m.VeiculoHistoricoComponent), title: 'Histórico · Bombase' },
      { path: 'estoque', loadComponent: () => import('./pages/estoque/estoque.component').then((m) => m.EstoqueComponent), title: 'Estoque · Bombase' },
      { path: 'os', loadComponent: () => import('./pages/os/os-quadro.component').then((m) => m.OsQuadroComponent), title: 'Ordens de serviço · Bombase' },
      { path: 'os/:id', loadComponent: () => import('./pages/os/os-detalhe.component').then((m) => m.OsDetalheComponent), title: 'OS · Bombase' },
      { path: 'financeiro', loadComponent: () => import('./pages/em-breve/em-breve.component').then((m) => m.EmBreveComponent), title: 'Financeiro · Bombase', data: { modulo: 'Financeiro multi-bancário', entrega: 'Entrega 2 · Sprints 3 e 4', itens: ['Contas bancárias e saldo em tempo real (RF10–RF12)', 'Lançamentos avulsos e PIX (RF13)', 'Liquidação com juros, descontos e taxas (RF14, RF15, RN02)', 'Liquidez D+1 (RF16, RF17)', 'Extrato geral com filtros (RF18–RF20)'] } },
    ],
  },
  { path: '**', redirectTo: '' },
];
