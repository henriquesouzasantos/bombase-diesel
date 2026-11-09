import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { diaInput, fmtBRL, fmtData, fmtDiaCurto } from '../../core/format';
import { ContaBancaria, Liquidez, TransacaoFinanceira, diasAtraso } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { LancamentoAvulsoComponent } from './lancamento-avulso.component';

/** RF16/RF17: liquidez D+1, saldos por conta e próximos vencimentos. */
@Component({
  selector: 'app-financeiro-visao',
  imports: [RouterLink, IconComponent, LancamentoAvulsoComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">Posição de caixa e projeção para o próximo dia útil.</p>
      <button type="button" class="btn-red" (click)="avulso.set(true)" [disabled]="!contas().length"><app-icon name="mais" [size]="18" /> Lançamento avulso</button>
    </div>

    @if (l(); as l) {
      <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Indicadores de liquidez">
        <div class="card p-4"><p class="text-xs text-muted">Disponível hoje</p><p class="mt-1 font-mono text-xl font-medium tabular-nums">{{ brl(l.disponivelHoje) }}</p></div>
        <div class="card border-brand/40 bg-brand-soft p-4">
          <p class="text-xs text-brand">Projeção D+1 · {{ dia(l.d1) }}</p>
          <p class="mt-1 font-mono text-xl font-medium tabular-nums" [class.text-bad]="l.projecaoD1 < 0" [class.text-brand]="l.projecaoD1 >= 0">{{ brl(l.projecaoD1) }}</p>
        </div>
        <a routerLink="titulos" [queryParams]="{ tipo: 'RECEBER' }" class="card p-4 hover:border-brand">
          <p class="text-xs text-muted">A receber vencido</p><p class="mt-1 font-mono text-xl font-medium tabular-nums" [class.text-warn]="l.vencidos.receber > 0">{{ brl(l.vencidos.receber) }}</p></a>
        <a routerLink="titulos" [queryParams]="{ tipo: 'PAGAR' }" class="card p-4 hover:border-brand">
          <p class="text-xs text-muted">A pagar vencido</p><p class="mt-1 font-mono text-xl font-medium tabular-nums" [class.text-bad]="l.vencidos.pagar > 0">{{ brl(l.vencidos.pagar) }}</p></a>
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section class="card p-5" aria-labelledby="fluxo-titulo">
          <h2 id="fluxo-titulo" class="font-display text-2xl italic uppercase text-ink">Fluxo dos próximos 7 dias</h2>
          <p class="mt-1 text-xs text-muted">Compensações e títulos pelo vencimento. Contas a pagar vencidas entram hoje.</p>
          <div class="mt-4 flex flex-col gap-2.5">
            @for (d of l.dias; track d.data) {
              <div class="grid grid-cols-[92px_1fr_110px] items-center gap-3 text-sm" [class.font-semibold]="d.data === l.d1">
                <span class="text-muted" [class.!text-brand]="d.data === l.d1">{{ dia(d.data) }}@if (d.data === l.d1) { · D+1 }</span>
                <span class="flex h-5 items-center">
                  <span class="flex h-full w-1/2 justify-end border-r border-line pr-px">
                    @if (d.saidas) { <span class="h-full rounded-l bg-bad/70" [style.width.%]="pctFluxo(d.saidas)" [attr.title]="'Saídas ' + brl(d.saidas)"></span> }
                  </span>
                  <span class="flex h-full w-1/2 pl-px">
                    @if (d.entradas) { <span class="h-full rounded-r bg-ok/70" [style.width.%]="pctFluxo(d.entradas)" [attr.title]="'Entradas ' + brl(d.entradas)"></span> }
                  </span>
                </span>
                <span class="text-right font-mono tabular-nums" [class.text-bad]="d.saldo < 0">{{ brl(d.saldo) }}</span>
              </div>
            }
          </div>
          <p class="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-bad/70"></span> Saídas</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-ok/70"></span> Entradas</span>
            <span>Coluna da direita: saldo projetado no fim do dia</span>
          </p>
        </section>

        <section class="card p-5" aria-labelledby="contas-titulo">
          <h2 id="contas-titulo" class="flex items-center gap-2 font-display text-2xl italic uppercase text-ink"><app-icon name="banco" /> Saldos por conta</h2>
          <ul class="mt-3 divide-y divide-line">
            @for (c of l.contas; track c.contaId) {
              <li class="py-3 text-sm">
                <div class="flex items-center justify-between gap-3"><span class="font-medium">{{ c.nomeBanco }}</span><span class="font-mono tabular-nums">{{ brl(c.saldoAtual) }}</span></div>
                @if (c.aCompensar) {
                  <p class="mt-0.5 flex justify-between text-xs text-muted"><span>a compensar {{ brl(c.aCompensar) }}</span><span>disponível {{ brl(c.disponivel) }}</span></p>
                }
              </li>
            } @empty { <li class="py-3 text-sm text-muted">Nenhuma conta ativa. <a routerLink="contas" class="text-brand hover:underline">Cadastrar conta</a></li> }
          </ul>
        </section>
      </div>

      <section class="card mt-6 overflow-x-auto" aria-labelledby="venc-titulo">
        <div class="flex items-center justify-between px-5 pt-5">
          <h2 id="venc-titulo" class="font-display text-2xl italic uppercase text-ink">Vencimentos da semana</h2>
          <a routerLink="titulos" class="text-sm font-medium text-brand hover:underline">Ver todos</a>
        </div>
        <table class="tbl mt-3 min-w-[640px]">
          <thead><tr><th>Vencimento</th><th>Tipo</th><th>Favorecido</th><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
          <tbody>
            @for (t of proximos(); track t._id) {
              <tr>
                <td class="font-mono" [class.text-bad]="atraso(t) > 0">{{ data(t.dataVencimento) }}@if (atraso(t) > 0) { <span class="ml-1 text-xs">({{ atraso(t) }}d)</span> }</td>
                <td>@if (t.natureza === 'ENTRADA') { <span class="pill-ok">Receber</span> } @else { <span class="pill-bad">Pagar</span> }</td>
                <td>{{ t.favorecido || '—' }}</td>
                <td class="text-muted">{{ t.descricao }}</td>
                <td class="text-right font-mono">{{ brl(t.valorBruto) }}</td>
              </tr>
            } @empty { <tr><td colspan="5" class="py-8 text-center text-muted">Nada vencendo nos próximos 7 dias.</td></tr> }
          </tbody>
        </table>
      </section>
    } @else {
      <p class="mt-8 text-muted">Calculando liquidez…</p>
    }

    @if (avulso()) { <app-lancamento-avulso [contas]="contas()" (fechar)="avulso.set(false)" (salvo)="avulso.set(false); carregar()" /> }
  `,
})
export class FinanceiroVisaoComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  l = signal<Liquidez | null>(null);
  contas = signal<ContaBancaria[]>([]);
  pendentes = signal<TransacaoFinanceira[]>([]);
  avulso = signal(false);
  brl = fmtBRL;
  data = fmtData;
  dia = fmtDiaCurto;
  atraso = (t: TransacaoFinanceira) => diasAtraso(t.dataVencimento);
  private maxFluxo = computed(() => Math.max(1, ...(this.l()?.dias ?? []).flatMap((d) => [d.entradas, d.saidas])));
  pctFluxo = (v: number) => (v / this.maxFluxo()) * 100;
  /** Vencidos + próximos 7 dias, do mais antigo para o mais novo. */
  proximos = computed(() => {
    const limite = new Date(diaInput(7) + 'T23:59:59');
    return this.pendentes().filter((t) => t.dataVencimento && new Date(t.dataVencimento) <= limite)
      .sort((a, z) => a.dataVencimento!.localeCompare(z.dataVencimento!)).slice(0, 12);
  });

  ngOnInit() { this.carregar(); }

  async carregar() {
    try {
      const [l, contas, pendentes] = await Promise.all([this.api.liquidez(), this.api.contas(), this.api.transacoes({ status: 'PENDENTE' })]);
      this.l.set(l);
      this.contas.set(contas.filter((c) => c.ativa));
      this.pendentes.set(pendentes);
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
}
