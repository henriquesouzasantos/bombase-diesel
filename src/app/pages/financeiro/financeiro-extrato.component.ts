import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, FiltroExtrato, mensagemErro } from '../../core/api.service';
import { diaInput, fmtBRL, fmtData } from '../../core/format';
import { ContaBancaria, MEIOS, STATUS_TRANSACAO, StatusTransacao, TIPOS_TRANSACAO, TipoTransacao, TransacaoFinanceira } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { LancamentoAvulsoComponent } from './lancamento-avulso.component';

const PILL_STATUS: Record<StatusTransacao, string> = { PENDENTE: 'pill-warn', LIQUIDADO: 'pill-info', CONCILIADO: 'pill-ok', CANCELADO: 'pill-bad' };

/** RF18–RF20: extrato geral com filtros, conciliação, estorno e exportação. */
@Component({
  selector: 'app-financeiro-extrato',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent, LancamentoAvulsoComponent],
  template: `
    <form class="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6" (ngSubmit)="carregar()" aria-label="Filtros do extrato">
      <label class="field"><span>De</span><input id="ext-de" class="input font-mono" type="date" name="de" [(ngModel)]="f.de"></label>
      <label class="field"><span>Até</span><input id="ext-ate" class="input font-mono" type="date" name="ate" [(ngModel)]="f.ate"></label>
      <label class="field"><span>Conta</span>
        <select id="ext-conta" class="input" name="conta" [(ngModel)]="f.contaId">
          <option value="">Todas</option>
          @for (c of contas(); track c._id) { <option [value]="c._id">{{ c.nomeBanco }}</option> }
        </select></label>
      <label class="field"><span>Tipo</span>
        <select id="ext-tipo" class="input" name="tipo" [(ngModel)]="f.tipo">
          <option value="">Todos</option>
          @for (t of tipos; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
        </select></label>
      <label class="field"><span>Situação</span>
        <select id="ext-status" class="input" name="status" [(ngModel)]="f.status">
          <option value="">Todas</option>
          @for (s of statusLista; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
        </select></label>
      <label class="field"><span>Busca</span><input id="ext-busca" class="input" name="busca" [(ngModel)]="f.busca" placeholder="Favorecido ou descrição"></label>
      <div class="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-6">
        <div class="flex flex-wrap gap-1.5">
          @for (p of periodos; track p.dias) { <button type="button" class="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:border-brand hover:text-brand" (click)="periodo(p.dias)">{{ p.nome }}</button> }
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn-ghost" (click)="exportar()" [disabled]="!lista().length"><app-icon name="download" [size]="16" /> CSV</button>
          <button type="button" class="btn-ghost" (click)="avulso.set(true)" [disabled]="!contasAtivas().length"><app-icon name="mais" [size]="16" /> Avulso</button>
          <button type="submit" class="btn-primary"><app-icon name="busca" [size]="16" /> Filtrar</button>
        </div>
      </div>
    </form>

    <section class="mt-4 grid grid-cols-3 gap-3" aria-label="Totais do período">
      <div class="card p-4"><p class="text-xs text-muted">Entradas</p><p class="mt-1 font-mono text-lg font-medium tabular-nums text-ok sm:text-xl">{{ brl(totais().entradas) }}</p></div>
      <div class="card p-4"><p class="text-xs text-muted">Saídas</p><p class="mt-1 font-mono text-lg font-medium tabular-nums text-bad sm:text-xl">{{ brl(totais().saidas) }}</p></div>
      <div class="card p-4"><p class="text-xs text-muted">Resultado</p><p class="mt-1 font-mono text-lg font-medium tabular-nums sm:text-xl" [class.text-bad]="totais().resultado < 0">{{ brl(totais().resultado) }}</p></div>
    </section>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[980px]">
        <thead><tr><th>Data</th><th>Compensa</th><th>Conta</th><th>Tipo</th><th>Favorecido / descrição</th><th>Meio</th><th class="text-right">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (t of lista(); track t._id) {
            <tr class="cursor-pointer hover:bg-canvas" (click)="detalhe.set(t)" [class.opacity-60]="t.status === 'CANCELADO'">
              <td class="font-mono">{{ data(t.dataEfetivacao ?? t.dataVencimento) }}</td>
              <td class="font-mono text-muted">{{ data(t.dataCompensacao) }}</td>
              <td>{{ t.contaNome || '—' }}</td>
              <td class="whitespace-nowrap">{{ tipoNome(t.tipo) }}</td>
              <td><span class="font-medium">{{ t.favorecido || '—' }}</span><br><span class="text-xs text-muted">{{ t.descricao }}</span></td>
              <td>{{ t.meio ? meioNome(t.meio) : '—' }}</td>
              <td class="whitespace-nowrap text-right font-mono" [class.text-ok]="t.natureza === 'ENTRADA'" [class.text-bad]="t.natureza === 'SAIDA'">
                {{ t.natureza === 'ENTRADA' ? '+' : '−' }} {{ brl(t.valorLiquido ?? t.valorBruto) }}
              </td>
              <td><span [class]="pill(t.status)">{{ statusNome(t.status) }}</span></td>
              <td class="whitespace-nowrap text-right" (click)="$event.stopPropagation()">
                @if (t.status === 'LIQUIDADO') { <button type="button" class="mr-3 text-sm font-medium text-brand hover:underline" (click)="conciliar(t)">Conciliar</button> }
                @if ((t.status === 'LIQUIDADO' || t.status === 'CONCILIADO') && t.tipo !== 'ESTORNO') {
                  <button type="button" class="text-muted hover:text-bad" (click)="estornar(t)" [attr.aria-label]="'Estornar ' + (t.descricao ?? '')" title="Estornar"><app-icon name="desfazer" [size]="18" /></button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="9" class="py-10 text-center text-muted">{{ carregando() ? 'Carregando…' : 'Nenhum lançamento no período.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-muted">Filtra pela data do pagamento. Títulos ainda não pagos estão em “A receber e a pagar”.</p>

    @if (detalhe(); as t) {
      <app-modal titulo="Lançamento" [largura]="560" (fechar)="detalhe.set(null)">
        <dl class="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Tipo</dt><dd>{{ tipoNome(t.tipo) }} · <span [class]="pill(t.status)">{{ statusNome(t.status) }}</span></dd>
          <dt class="text-muted">Favorecido</dt><dd>{{ t.favorecido || '—' }}</dd>
          <dt class="text-muted">Descrição</dt><dd>{{ t.descricao || '—' }}</dd>
          @if (t.osId) { <dt class="text-muted">Ordem de serviço</dt><dd><a [routerLink]="['/app/os', t.osId]" class="font-mono text-brand hover:underline" (click)="detalhe.set(null)">#{{ t.osNumero }}</a></dd> }
          <dt class="text-muted">Conta / meio</dt><dd>{{ t.contaNome || '—' }} · {{ t.meio ? meioNome(t.meio) : '—' }}</dd>
          <dt class="text-muted">Vencimento</dt><dd class="font-mono">{{ data(t.dataVencimento) }}</dd>
          <dt class="text-muted">Pagamento</dt><dd class="font-mono">{{ data(t.dataEfetivacao) }}</dd>
          <dt class="text-muted">Compensação</dt><dd class="font-mono">{{ data(t.dataCompensacao) }}</dd>
          <dt class="text-muted">Bruto</dt><dd class="font-mono">{{ brl(t.valorBruto) }}</dd>
          <dt class="text-muted">Desconto / juros / taxa</dt><dd class="font-mono">{{ brl(t.desconto ?? 0) }} / {{ brl(t.jurosMulta ?? 0) }} / {{ brl(t.taxaBancaria ?? 0) }}</dd>
          <dt class="font-semibold">Valor líquido</dt><dd class="font-mono font-semibold">{{ t.valorLiquido != null ? brl(t.valorLiquido) : '—' }}</dd>
          <dt class="text-muted">Registrado por</dt><dd>{{ t.usuario || '—' }}</dd>
          @if (t.hash) {
            <dt class="flex items-center gap-1 text-muted"><app-icon name="cadeado" [size]="14" /> Hash (RN03)</dt>
            <dd class="break-all font-mono text-xs">{{ t.hash }}<br><span class="text-muted">anterior: {{ t.hashAnterior || '(início da cadeia)' }}</span></dd>
          }
        </dl>
      </app-modal>
    }

    @if (avulso()) { <app-lancamento-avulso [contas]="contasAtivas()" (fechar)="avulso.set(false)" (salvo)="avulso.set(false); carregar()" /> }
  `,
})
export class FinanceiroExtratoComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  tipos = Object.entries(TIPOS_TRANSACAO) as [TipoTransacao, string][];
  statusLista = Object.entries(STATUS_TRANSACAO) as [StatusTransacao, string][];
  periodos = [{ nome: 'Hoje', dias: 0 }, { nome: '7 dias', dias: 7 }, { nome: '30 dias', dias: 30 }, { nome: '90 dias', dias: 90 }];
  f: Required<Omit<FiltroExtrato, 'campo'>> = { de: diaInput(-30), ate: diaInput(), contaId: '', tipo: '', status: '', busca: '' };
  lista = signal<TransacaoFinanceira[]>([]);
  contas = signal<ContaBancaria[]>([]);
  contasAtivas = computed(() => this.contas().filter((c) => c.ativa));
  detalhe = signal<TransacaoFinanceira | null>(null);
  avulso = signal(false);
  carregando = signal(true);
  brl = fmtBRL;
  data = fmtData;
  tipoNome = (t: TipoTransacao) => TIPOS_TRANSACAO[t];
  statusNome = (s: StatusTransacao) => STATUS_TRANSACAO[s];
  meioNome = (m: keyof typeof MEIOS) => MEIOS[m];
  pill = (s: StatusTransacao) => PILL_STATUS[s];

  /** Original estornado + estorno se anulam, por isso entram os dois. Títulos não pagos não têm valor líquido. */
  totais = computed(() => {
    let entradas = 0;
    let saidas = 0;
    for (const t of this.lista()) {
      if (t.valorLiquido == null || !t.dataEfetivacao) continue;
      if (t.natureza === 'ENTRADA') entradas += t.valorLiquido; else saidas += t.valorLiquido;
    }
    const c = (v: number) => Math.round(v * 100) / 100;
    return { entradas: c(entradas), saidas: c(saidas), resultado: c(entradas - saidas) };
  });

  async ngOnInit() {
    try { this.contas.set(await this.api.contas()); } catch (e) { this.toast.erro(mensagemErro(e)); }
    this.carregar();
  }

  periodo(dias: number) {
    this.f.de = diaInput(-dias);
    this.f.ate = diaInput();
    this.carregar();
  }

  async carregar() {
    this.carregando.set(true);
    try { this.lista.set(await this.api.transacoes({ ...this.f, campo: 'efetivacao' })); }
    catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.carregando.set(false); }
  }

  async conciliar(t: TransacaoFinanceira) {
    try {
      await this.api.conciliar(t._id!);
      this.toast.ok('Lançamento conciliado com o extrato do banco.');
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  async estornar(t: TransacaoFinanceira) {
    if (!confirm(`Estornar "${t.descricao}" de ${this.brl(t.valorLiquido ?? 0)}? Um lançamento inverso será criado e o saldo de ${t.contaNome} será ajustado.`)) return;
    try {
      await this.api.estornar(t._id!);
      this.toast.ok('Estorno registrado.');
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  /** RF20: exporta o que está na tela (separador ; e vírgula decimal, para abrir direto no Excel em pt-BR). */
  exportar() {
    const num = (v?: number) => (v ?? 0).toFixed(2).replace('.', ',');
    const esc = (s?: string) => `"${(s ?? '').replace(/"/g, '""')}"`;
    const linhas = [
      ['Data', 'Compensação', 'Vencimento', 'Conta', 'Tipo', 'Natureza', 'Favorecido', 'Descrição', 'Meio', 'Bruto', 'Desconto', 'Juros/multa', 'Taxa', 'Líquido', 'Situação'].join(';'),
      ...this.lista().map((t) => [
        this.data(t.dataEfetivacao), this.data(t.dataCompensacao), this.data(t.dataVencimento), esc(t.contaNome), this.tipoNome(t.tipo), t.natureza,
        esc(t.favorecido), esc(t.descricao), t.meio ?? '', num(t.valorBruto), num(t.desconto), num(t.jurosMulta), num(t.taxaBancaria),
        t.valorLiquido != null ? num(t.valorLiquido) : '', this.statusNome(t.status),
      ].join(';')),
    ];
    const blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `extrato-${this.f.de || 'inicio'}-a-${this.f.ate || 'hoje'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
