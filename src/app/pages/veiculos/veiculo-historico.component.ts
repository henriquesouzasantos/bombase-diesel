import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { fmtBRL, fmtData, fmtNum } from '../../core/format';
import { OrdemServico, Veiculo, totalOS } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { StatusPillComponent } from '../../shared/status-pill.component';

@Component({
  selector: 'app-veiculo-historico',
  imports: [RouterLink, IconComponent, StatusPillComponent],
  template: `
    <a routerLink="/app/veiculos" class="inline-flex items-center gap-1 text-sm text-brand hover:underline"><app-icon name="voltar" [size]="16" /> Veículos</a>
    @if (v(); as v) {
      <p class="eyebrow mt-4">RF03 · Histórico de manutenção</p>
      <h1 class="page-title mt-2">{{ v.marca }} {{ v.modelo }} · {{ v.placa }}</h1>
      <dl class="card mt-6 grid gap-4 p-5 sm:grid-cols-4">
        @for (d of [['Cliente', v.clienteNome], ['Chassi', v.chassi], ['Motor', v.motor || '—'], ['Hodômetro', num(v.hodometro) + ' km']]; track d[0]) {
          <div><dt class="text-xs text-muted">{{ d[0] }}</dt><dd class="mt-1 font-mono text-sm">{{ d[1] }}</dd></div>
        }
      </dl>
      <ol class="mt-6 flex flex-col gap-3">
        @for (o of hist(); track o._id) {
          <li class="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <a [routerLink]="['/app/os', o._id]" class="font-mono text-brand hover:underline">OS #{{ o.numero }}</a>
              <span class="ml-2 font-mono text-xs text-muted">{{ data(o.dataEntrada) }}</span>
              <p class="mt-1 text-sm">{{ o.descricao }}</p>
            </div>
            <div class="flex items-center gap-4"><span class="font-mono text-sm">{{ brl(total(o)) }}</span><app-status-pill [status]="o.status" /></div>
          </li>
        } @empty { <li class="text-muted">Nenhuma manutenção registrada.</li> }
      </ol>
    }
  `,
})
export class VeiculoHistoricoComponent implements OnInit {
  id = input.required<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  v = signal<Veiculo | null>(null);
  hist = signal<OrdemServico[]>([]);
  brl = fmtBRL; data = fmtData; num = fmtNum;
  total = (o: OrdemServico) => totalOS(o).total;

  async ngOnInit() {
    try {
      const [v, h] = await Promise.all([this.api.veiculo(this.id()), this.api.historicoVeiculo(this.id())]);
      this.v.set(v); this.hist.set(h);
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
}
