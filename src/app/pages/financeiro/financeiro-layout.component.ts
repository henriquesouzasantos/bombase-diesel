import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../../shared/icon.component';

/** Casca do módulo financeiro: título e abas (visão geral, títulos, extrato, contas). */
@Component({
  selector: 'app-financeiro-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <p class="eyebrow">RF10–RF20 · Financeiro multi-bancário</p>
    <h1 class="page-title mt-2">Financeiro</h1>
    <nav class="mt-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seções do financeiro">
      @for (a of abas; track a.rota) {
        <a [routerLink]="a.rota" routerLinkActive="!border-bomb-red !text-ink" [routerLinkActiveOptions]="{ exact: a.exato }"
          class="-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted hover:text-ink">
          <app-icon [name]="a.icone" [size]="16" /> {{ a.nome }}
        </a>
      }
    </nav>
    <div class="mt-6"><router-outlet /></div>
  `,
})
export class FinanceiroLayoutComponent {
  abas = [
    { rota: '/app/financeiro', nome: 'Visão geral', icone: 'home', exato: true },
    { rota: '/app/financeiro/titulos', nome: 'A receber e a pagar', icone: 'calendario', exato: false },
    { rota: '/app/financeiro/extrato', nome: 'Extrato', icone: 'lista', exato: false },
    { rota: '/app/financeiro/contas', nome: 'Contas bancárias', icone: 'banco', exato: false },
  ];
}
