import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, Painel, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtBRL, fmtData } from '../../core/format';
import { STATUS_OS } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { StatusPillComponent } from '../../shared/status-pill.component';

@Component({
  selector: 'app-painel',
  imports: [RouterLink, IconComponent, StatusPillComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="eyebrow">Painel</p>
        <h1 class="page-title mt-2">Bem-vindo, {{ auth.user()?.nome }}!</h1>
      </div>
      @if (auth.pode('RECEPCAO')) { <a routerLink="/app/os" [queryParams]="{ nova: 1 }" class="btn-red"><app-icon name="mais" [size]="18" /> Nova OS</a> }
    </div>

    @if (p(); as p) {
      <section class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores">
        @for (k of [
          { t: 'OS em aberto', v: p.osAbertas + '' },
          { t: 'Faturado no mês', v: brl(p.faturadoMes) },
          { t: 'Clientes', v: p.clientes + '' },
          { t: 'Veículos', v: p.veiculos + '' }
        ]; track k.t) {
          <div class="card p-4"><p class="text-xs text-muted">{{ k.t }}</p><p class="mt-1 font-mono text-xl font-medium tabular-nums">{{ k.v }}</p></div>
        }
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section class="card p-5">
          <h2 class="font-display text-2xl italic uppercase text-ink">OS por status</h2>
          <div class="mt-4 flex flex-col gap-3">
            @for (s of status; track s.id) {
              <div class="grid grid-cols-[130px_1fr_32px] items-center gap-3 text-sm">
                <span class="text-muted">{{ s.nome }}</span>
                <span class="h-2.5 overflow-hidden rounded-full bg-canvas"><span class="block h-full rounded-full bg-brand transition-all" [style.width.%]="pct(p.osPorStatus[s.id], max(p))"></span></span>
                <span class="text-right font-mono tabular-nums">{{ p.osPorStatus[s.id] }}</span>
              </div>
            }
          </div>
        </section>
        <section class="card p-5">
          <h2 class="flex items-center gap-2 font-display text-2xl italic uppercase text-ink"><app-icon name="alerta" class="text-bad" /> Alertas de estoque</h2>
          @if (p.pecasAbaixoMinimo.length) {
            <ul class="mt-3 divide-y divide-line">
              @for (x of p.pecasAbaixoMinimo; track x._id) {
                <li class="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span><b class="font-mono font-medium">{{ x.sku }}</b> · {{ x.descricao }}</span>
                  <span class="pill-bad">{{ x.saldo }} / mín {{ x.estoqueMinimo }}</span>
                </li>
              }
            </ul>
            <a routerLink="/app/estoque" class="mt-3 inline-block text-sm font-medium text-brand hover:underline">Ver estoque</a>
          } @else {
            <p class="mt-3 text-sm text-muted">Todas as peças acima do estoque mínimo.</p>
          }
        </section>
      </div>

      <section class="card mt-6 overflow-x-auto">
        <h2 class="px-5 pt-5 font-display text-2xl italic uppercase text-ink">Últimas ordens de serviço</h2>
        <table class="tbl mt-3 min-w-[640px]">
          <thead><tr><th>OS</th><th>Veículo</th><th>Cliente</th><th>Entrada</th><th>Status</th></tr></thead>
          <tbody>
            @for (o of p.ultimasOS; track o._id) {
              <tr class="cursor-pointer hover:bg-canvas" [routerLink]="['/app/os', o._id]">
                <td class="font-mono text-brand">#{{ o.numero }}</td><td>{{ o.veiculoDescricao }}</td><td>{{ o.clienteNome }}</td>
                <td class="font-mono">{{ data(o.dataEntrada) }}</td><td><app-status-pill [status]="o.status" /></td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    } @else {
      <p class="mt-8 text-muted">Carregando indicadores…</p>
    }
  `,
})
export class PainelComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  p = signal<Painel | null>(null);
  status = STATUS_OS;
  brl = fmtBRL;
  data = fmtData;

  async ngOnInit() {
    try { this.p.set(await this.api.painel()); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
  max(p: Painel) { return Math.max(1, ...Object.values(p.osPorStatus)); }
  pct(v: number, m: number) { return (v / m) * 100; }
}
