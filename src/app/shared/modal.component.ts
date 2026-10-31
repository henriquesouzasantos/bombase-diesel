import { Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-modal',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4" (click)="fechar.emit()" (keydown.escape)="fechar.emit()">
      <div role="dialog" aria-modal="true" [attr.aria-label]="titulo()"
        class="max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" [style.max-width.px]="largura()" (click)="$event.stopPropagation()">
        <div class="mb-5 flex items-start justify-between gap-4">
          <h2 class="font-display text-3xl italic uppercase text-brand">{{ titulo() }}</h2>
          <button type="button" class="text-muted hover:text-ink" (click)="fechar.emit()" aria-label="Fechar"><app-icon name="fechar" /></button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  titulo = input.required<string>();
  largura = input(560);
  fechar = output<void>();
}
