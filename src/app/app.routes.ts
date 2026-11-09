import { Routes } from '@angular/router';
import { authGuard, perfilGuard } from './core/guards';

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
      {
        path: 'financeiro',
        canActivate: [perfilGuard('GERENTE_FINANCEIRO')],
        loadComponent: () => import('./pages/financeiro/financeiro-layout.component').then((m) => m.FinanceiroLayoutComponent),
        children: [
          { path: '', loadComponent: () => import('./pages/financeiro/financeiro-visao.component').then((m) => m.FinanceiroVisaoComponent), title: 'Financeiro · Bombase' },
          { path: 'titulos', loadComponent: () => import('./pages/financeiro/financeiro-titulos.component').then((m) => m.FinanceiroTitulosComponent), title: 'A receber e a pagar · Bombase' },
          { path: 'extrato', loadComponent: () => import('./pages/financeiro/financeiro-extrato.component').then((m) => m.FinanceiroExtratoComponent), title: 'Extrato · Bombase' },
          { path: 'contas', loadComponent: () => import('./pages/financeiro/financeiro-contas.component').then((m) => m.FinanceiroContasComponent), title: 'Contas bancárias · Bombase' },
        ],
      },
      { path: 'usuarios', canActivate: [perfilGuard()], loadComponent: () => import('./pages/usuarios/usuarios.component').then((m) => m.UsuariosComponent), title: 'Usuários · Bombase' },
    ],
  },
  { path: '**', redirectTo: '' },
];
