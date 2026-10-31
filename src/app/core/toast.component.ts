import { Component, Injectable, inject, signal } from '@angular/core';

type Tipo = 'ok' | 'erro';

/** Avisos visuais (RNF01.4): verde #059669 sucesso, vermelho #dc2626 falha. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly atual = signal<{ msg: string; tipo: Tipo } | null>(null);
  private t?: ReturnType<typeof setTimeout>;
  ok(msg: string) { this.show(msg, 'ok'); }
  erro(msg: string) { this.show(msg, 'erro'); }
  private show(msg: string, tipo: Tipo) {
    this.atual.set({ msg, tipo });
    clearTimeout(this.t);
    this.t = setTimeout(() => this.atual.set(null), tipo === 'erro' ? 6000 : 3500);
  }
}

@Component({
  selector: 'app-toast',
  template: `
    @if (toast.atual(); as t) {
      <div role="status" aria-live="polite"
        class="fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-xl"
        [class.bg-ok]="t.tipo === 'ok'" [class.bg-bad]="t.tipo === 'erro'">
        <span>{{ t.msg }}</span>
        <button type="button" class="opacity-80 hover:opacity-100" (click)="toast.atual.set(null)" aria-label="Fechar aviso">✕</button>
      </div>
    }
  `,
})
export class ToastComponent {
  toast = inject(ToastService);
}
