import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-em-breve',
  template: `
    <p class="eyebrow">{{ d['entrega'] }}</p>
    <h1 class="page-title mt-2">{{ d['modulo'] }}</h1>
    <p class="mt-3 max-w-prose text-muted">Este módulo está planejado para a próxima entrega. Os modelos de dados já existem no backend (ContaBancaria e TransacaoFinanceira).</p>
    <ul class="card mt-6 divide-y divide-line">
      @for (i of d['itens']; track i) { <li class="px-5 py-3 text-sm">{{ i }}</li> }
    </ul>
  `,
})
export class EmBreveComponent {
  d = inject(ActivatedRoute).snapshot.data;
}
