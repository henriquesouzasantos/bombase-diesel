import { Component, computed, input } from '@angular/core';
import { STATUS_OS, StatusOS } from '../core/models';

const COR: Record<StatusOS, string> = {
  ABERTO: 'pill-info', EM_ANDAMENTO: 'pill-info', AGUARDANDO_PECAS: 'pill-warn',
  QUALIDADE: 'pill-warn', CONCLUIDO: 'pill-ok', FATURADO: 'pill-ok',
};

@Component({
  selector: 'app-status-pill',
  template: `<span [class]="cor()">{{ nome() }}</span>`,
})
export class StatusPillComponent {
  status = input.required<StatusOS>();
  nome = computed(() => STATUS_OS.find((s) => s.id === this.status())?.nome ?? this.status());
  cor = computed(() => COR[this.status()]);
}
