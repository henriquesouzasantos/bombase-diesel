import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { PERFIS } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { LogoComponent } from '../shared/logo.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, IconComponent],
  template: `
    <div class="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <!-- menu lateral -->
      <aside class="fixed inset-y-0 left-0 z-40 w-64 -translate-x-full bg-brand-deep text-white transition-transform lg:static lg:w-auto lg:translate-x-0"
        [class.translate-x-0]="aberto()">
        <div class="flex h-16 items-center justify-between px-5">
          <a routerLink="/" aria-label="Página inicial"><app-logo [claro]="true" /></a>
          <button type="button" class="lg:hidden" (click)="aberto.set(false)" aria-label="Fechar menu"><app-icon name="fechar" /></button>
        </div>
        <nav class="mt-4 flex flex-col gap-1 px-3" aria-label="Módulos">
          @for (m of menu; track m.rota) {
            <a [routerLink]="m.rota" routerLinkActive="!bg-white/10 !text-white before:!bg-bomb-red"
              (click)="aberto.set(false)"
              class="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A9C3E0] before:absolute before:left-0 before:top-2 before:h-6 before:w-1 before:rounded-r before:bg-transparent hover:bg-white/5 hover:text-white">
              <app-icon [name]="m.icone" /> {{ m.nome }}
              @if (m.badge) { <span class="ml-auto rounded bg-white/10 px-1.5 text-[10px] uppercase tracking-wide">{{ m.badge }}</span> }
            </a>
          }
        </nav>
        @if (demo) {
          <p class="absolute bottom-4 left-4 right-4 rounded-lg border border-white/15 p-3 text-xs text-[#A9C3E0]">
            Modo demonstração: os dados ficam só na memória do navegador.
          </p>
        }
      </aside>
      @if (aberto()) { <div class="fixed inset-0 z-30 bg-black/40 lg:hidden" (click)="aberto.set(false)"></div> }

      <div class="min-w-0">
        <header class="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-8">
          <button type="button" class="lg:hidden" (click)="aberto.set(true)" aria-label="Abrir menu"><app-icon name="menu" /></button>
          <span class="hidden font-mono text-xs text-muted sm:block">{{ hoje }}</span>
          @if (auth.user(); as u) {
            <div class="flex items-center gap-3">
              <div class="text-right leading-tight">
                <p class="text-sm font-semibold">{{ u.nome }}</p>
                <p class="text-xs text-muted">{{ perfis[u.perfil] }}</p>
              </div>
              <span class="grid h-9 w-9 place-items-center rounded-full bg-brand font-display text-lg font-bold text-white">{{ u.nome.charAt(0) }}</span>
              <button type="button" class="btn-ghost !px-2.5" (click)="auth.logout()" title="Sair" aria-label="Sair"><app-icon name="sair" [size]="18" /></button>
            </div>
          }
        </header>
        <main class="mx-auto max-w-7xl px-4 py-8 sm:px-8"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  auth = inject(AuthService);
  aberto = signal(false);
  demo = environment.demo;
  perfis = PERFIS;
  hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
  menu = [
    { rota: '/app/painel', nome: 'Painel', icone: 'home' },
    { rota: '/app/os', nome: 'Ordens de serviço', icone: 'chave' },
    { rota: '/app/clientes', nome: 'Clientes', icone: 'usuarios' },
    { rota: '/app/veiculos', nome: 'Veículos', icone: 'caminhao' },
    { rota: '/app/estoque', nome: 'Estoque', icone: 'pacote' },
    { rota: '/app/financeiro', nome: 'Financeiro', icone: 'carteira', badge: 'E2' },
  ];
}
