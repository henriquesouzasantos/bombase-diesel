import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { diaInput, fmtBRL, fmtData, isoMeioDia } from '../../core/format';
import {
  ContaBancaria, MEIOS, Meio, TransacaoFinanceira, diasAtraso, jurosMultaAtraso, taxaSugerida, valorEfetivo,
} from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

type Aba = 'RECEBER' | 'PAGAR';

interface FormLiquidar {
  titulo: TransacaoFinanceira;
  contaId: string;
  meio: Meio;
  data: string;
  desconto: number;
  jurosMulta: number;
  taxaBancaria: number;
}

/** RF14/RF15 + RN02: contas a receber e a pagar, com liquidação. */
@Component({
  selector: 'app-financeiro-titulos',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="inline-flex rounded-lg border border-line bg-white p-1" role="tablist" aria-label="Tipo de título">
        @for (a of abas; track a.id) {
          <button type="button" role="tab" [attr.aria-selected]="aba() === a.id" (click)="trocar(a.id)"
            class="rounded-md px-4 py-1.5 text-sm font-semibold" [class]="aba() === a.id ? 'bg-brand text-white' : 'text-muted hover:text-ink'">{{ a.nome }}</button>
        }
      </div>
      <button type="button" class="btn-red" (click)="novo()"><app-icon name="mais" [size]="18" /> Novo título {{ aba() === 'RECEBER' ? 'a receber' : 'a pagar' }}</button>
    </div>

    <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Totais">
      <div class="card p-4"><p class="text-xs text-muted">Em aberto</p><p class="mt-1 font-mono text-xl font-medium tabular-nums">{{ brl(totais().aberto) }}</p><p class="text-xs text-muted">{{ visiveis().length }} título(s)</p></div>
      <div class="card p-4"><p class="text-xs text-muted">Vencido</p><p class="mt-1 font-mono text-xl font-medium tabular-nums" [class.text-bad]="totais().vencido > 0">{{ brl(totais().vencido) }}</p></div>
      <div class="card col-span-2 p-4 lg:col-span-1"><p class="text-xs text-muted">Vence nos próximos 7 dias</p><p class="mt-1 font-mono text-xl font-medium tabular-nums">{{ brl(totais().semana) }}</p></div>
    </section>

    <div class="mt-4 flex flex-wrap items-center gap-4">
      <label class="relative block w-full max-w-md">
        <span class="sr-only">Buscar</span>
        <app-icon name="busca" [size]="18" class="absolute left-3 top-2.5 text-muted" />
        <input id="busca-titulos" class="input pl-10" placeholder="Favorecido ou descrição" [ngModel]="busca()" (ngModelChange)="busca.set($event)">
      </label>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" [ngModel]="soVencidos()" (ngModelChange)="soVencidos.set($event)" name="vencidos"> Só vencidos</label>
    </div>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[860px]">
        <thead><tr><th>Vencimento</th><th>{{ aba() === 'RECEBER' ? 'Cliente' : 'Fornecedor' }}</th><th>Descrição</th><th class="text-right">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (t of visiveis(); track t._id) {
            <tr>
              <td class="font-mono">{{ data(t.dataVencimento) }}</td>
              <td class="font-medium">{{ t.favorecido || '—' }}</td>
              <td class="text-muted">
                {{ t.descricao }}
                @if (t.osId) { · <a [routerLink]="['/app/os', t.osId]" class="font-mono text-brand hover:underline">OS #{{ t.osNumero }}</a> }
              </td>
              <td class="text-right font-mono">{{ brl(t.valorBruto) }}</td>
              <td>
                @if (atraso(t) > 0) { <span class="pill-bad">Vencido há {{ atraso(t) }}d</span> }
                @else if (venceHoje(t)) { <span class="pill-warn">Vence hoje</span> }
                @else { <span class="pill-info">Em dia</span> }
              </td>
              <td class="whitespace-nowrap text-right">
                <button type="button" class="mr-3 text-sm font-semibold text-brand hover:underline" (click)="abrirLiquidar(t)">{{ aba() === 'RECEBER' ? 'Receber' : 'Pagar' }}</button>
                <button type="button" class="text-sm text-muted hover:text-bad" (click)="cancelar(t)">Cancelar</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="py-10 text-center text-muted">{{ carregando() ? 'Carregando…' : 'Nenhum título em aberto.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f.tipo === 'RECEBER' ? 'Novo título a receber' : 'Novo título a pagar'" [largura]="520" (fechar)="form.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar()">
          <label class="field sm:col-span-2"><span>{{ f.tipo === 'RECEBER' ? 'Cliente' : 'Fornecedor' }}</span><input id="tit-fav" class="input" name="fav" [(ngModel)]="f.favorecido" required></label>
          <label class="field sm:col-span-2"><span>Descrição</span><input id="tit-desc" class="input" name="desc" [(ngModel)]="f.descricao" required placeholder="NF, parcela, referência"></label>
          <label class="field"><span>Valor (R$)</span><input id="tit-valor" class="input font-mono" type="number" step="0.01" min="0.01" name="valor" [(ngModel)]="f.valorBruto" required></label>
          <label class="field"><span>Vencimento</span><input id="tit-venc" class="input font-mono" type="date" name="venc" [(ngModel)]="f.vencimento" required></label>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="salvando()">Salvar título</button>
          </div>
        </form>
      </app-modal>
    }

    @if (liq(); as q) {
      <app-modal [titulo]="q.titulo.natureza === 'ENTRADA' ? 'Receber título' : 'Pagar título'" [largura]="560" (fechar)="liq.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="confirmarLiquidacao()">
          <p class="text-sm sm:col-span-2"><b>{{ q.titulo.favorecido }}</b> · {{ q.titulo.descricao }}<br>
            <span class="text-muted">Vencimento {{ data(q.titulo.dataVencimento) }}@if (atraso(q.titulo) > 0) { · <span class="text-bad">{{ atraso(q.titulo) }} dia(s) de atraso</span> }</span></p>
          <label class="field"><span>Conta</span>
            <select id="liq-conta" class="input" name="conta" [(ngModel)]="q.contaId" (ngModelChange)="sugerirTaxa(q)" required>
              @for (c of contas(); track c._id) { <option [value]="c._id">{{ c.nomeBanco }}</option> }
            </select></label>
          <label class="field"><span>Meio</span>
            <select id="liq-meio" class="input" name="meio" [(ngModel)]="q.meio" (ngModelChange)="sugerirTaxa(q)">
              @for (m of meios; track m[0]) { <option [value]="m[0]">{{ m[1] }}</option> }
            </select></label>
          <label class="field"><span>Data do pagamento</span><input id="liq-data" class="input font-mono" type="date" name="data" [(ngModel)]="q.data" [max]="hoje" required></label>
          <label class="field"><span>Desconto (R$)</span><input id="liq-desc" class="input font-mono" type="number" step="0.01" min="0" name="desc" [(ngModel)]="q.desconto"></label>
          <label class="field"><span>Juros e multa (R$)</span><input id="liq-juros" class="input font-mono" type="number" step="0.01" min="0" name="juros" [(ngModel)]="q.jurosMulta"></label>
          <label class="field"><span>Taxa bancária (R$)</span><input id="liq-taxa" class="input font-mono" type="number" step="0.01" min="0" name="taxa" [(ngModel)]="q.taxaBancaria"></label>

          <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-canvas p-4 font-mono text-sm sm:col-span-2" aria-label="Cálculo RN02">
            <dt class="font-sans text-muted">Valor bruto</dt><dd class="text-right">{{ brl(q.titulo.valorBruto) }}</dd>
            <dt class="font-sans text-muted">− Desconto</dt><dd class="text-right">{{ brl(+q.desconto || 0) }}</dd>
            <dt class="font-sans text-muted">+ Juros e multa</dt><dd class="text-right">{{ brl(+q.jurosMulta || 0) }}</dd>
            <dt class="font-sans text-muted">{{ q.titulo.natureza === 'ENTRADA' ? '−' : '+' }} Taxa bancária</dt><dd class="text-right">{{ brl(+q.taxaBancaria || 0) }}</dd>
            <dt class="border-t border-line pt-1 font-sans font-semibold text-ink">{{ q.titulo.natureza === 'ENTRADA' ? 'Valor líquido (RN02)' : 'Total a pagar' }}</dt>
            <dd class="border-t border-line pt-1 text-right text-base font-semibold" [class.text-bad]="liquido(q) <= 0" [class.text-brand]="liquido(q) > 0">{{ brl(liquido(q)) }}</dd>
          </dl>
          @if (atraso(q.titulo) > 0) {
            <p class="text-xs text-muted sm:col-span-2">Juros sugeridos: multa de 2% + 0,033% ao dia sobre o bruto. Ajuste se houver acordo com o cliente.</p>
          }
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="liq.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="salvando() || liquido(q) <= 0">Confirmar {{ q.titulo.natureza === 'ENTRADA' ? 'recebimento' : 'pagamento' }}</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class FinanceiroTitulosComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  abas: { id: Aba; nome: string }[] = [{ id: 'RECEBER', nome: 'A receber' }, { id: 'PAGAR', nome: 'A pagar' }];
  meios = Object.entries(MEIOS) as [Meio, string][];
  hoje = diaInput();
  aba = signal<Aba>('RECEBER');
  lista = signal<TransacaoFinanceira[]>([]);
  contas = signal<ContaBancaria[]>([]);
  busca = signal('');
  soVencidos = signal(false);
  carregando = signal(true);
  salvando = signal(false);
  form = signal<{ tipo: Aba; favorecido: string; descricao: string; valorBruto: number; vencimento: string } | null>(null);
  liq = signal<FormLiquidar | null>(null);

  brl = fmtBRL;
  data = fmtData;
  atraso = (t: TransacaoFinanceira) => diasAtraso(t.dataVencimento);
  venceHoje = (t: TransacaoFinanceira) => !!t.dataVencimento && fmtData(t.dataVencimento) === fmtData(new Date().toISOString());

  visiveis = computed(() => {
    const b = this.busca().trim().toLowerCase();
    return this.lista()
      .filter((t) => t.tipo === this.aba())
      .filter((t) => !this.soVencidos() || this.atraso(t) > 0)
      .filter((t) => !b || `${t.favorecido ?? ''} ${t.descricao ?? ''}`.toLowerCase().includes(b))
      .sort((a, z) => (a.dataVencimento ?? '').localeCompare(z.dataVencimento ?? ''));
  });

  totais = computed(() => {
    const limite = new Date(diaInput(7) + 'T23:59:59');
    const doTipo = this.lista().filter((t) => t.tipo === this.aba());
    const soma = (l: TransacaoFinanceira[]) => Math.round(l.reduce((s, t) => s + t.valorBruto, 0) * 100) / 100;
    return {
      aberto: soma(doTipo),
      vencido: soma(doTipo.filter((t) => this.atraso(t) > 0)),
      semana: soma(doTipo.filter((t) => this.atraso(t) === 0 && t.dataVencimento && new Date(t.dataVencimento) <= limite)),
    };
  });

  ngOnInit() {
    const tipo = this.route.snapshot.queryParamMap.get('tipo');
    if (tipo === 'PAGAR' || tipo === 'RECEBER') this.aba.set(tipo);
    this.carregar();
  }

  trocar(a: Aba) {
    this.aba.set(a);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tipo: a }, replaceUrl: true });
  }

  async carregar() {
    try {
      const [lista, contas] = await Promise.all([this.api.transacoes({ status: 'PENDENTE', tipo: 'RECEBER,PAGAR' }), this.api.contas()]);
      this.lista.set(lista);
      this.contas.set(contas.filter((c) => c.ativa));
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.carregando.set(false); }
  }

  novo() { this.form.set({ tipo: this.aba(), favorecido: '', descricao: '', valorBruto: 0, vencimento: diaInput(this.aba() === 'RECEBER' ? 28 : 0) }); }

  async salvar() {
    const f = this.form()!;
    this.salvando.set(true);
    try {
      await this.api.lancar({ tipo: f.tipo, favorecido: f.favorecido, descricao: f.descricao, valorBruto: +f.valorBruto, dataVencimento: isoMeioDia(f.vencimento) });
      this.toast.ok('Título cadastrado.');
      this.form.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.salvando.set(false); }
  }

  abrirLiquidar(t: TransacaoFinanceira) {
    if (!this.contas().length) { this.toast.erro('Cadastre uma conta bancária ativa antes de liquidar.'); return; }
    const q: FormLiquidar = {
      titulo: t, contaId: this.contas()[0]._id!, meio: t.natureza === 'ENTRADA' ? 'BOLETO' : 'TED', data: this.hoje,
      desconto: 0, jurosMulta: t.natureza === 'ENTRADA' ? jurosMultaAtraso(t.valorBruto, this.atraso(t)) : 0, taxaBancaria: 0,
    };
    this.sugerirTaxa(q);
    this.liq.set(q);
  }

  sugerirTaxa(q: FormLiquidar) {
    q.taxaBancaria = q.titulo.natureza === 'ENTRADA' ? taxaSugerida(this.contas().find((c) => c._id === q.contaId), q.meio, q.titulo.valorBruto) : 0;
  }

  liquido(q: FormLiquidar) { return valorEfetivo(q.titulo.natureza, q.titulo.valorBruto, +q.desconto || 0, +q.jurosMulta || 0, +q.taxaBancaria || 0); }

  async confirmarLiquidacao() {
    const q = this.liq()!;
    this.salvando.set(true);
    try {
      await this.api.liquidar(q.titulo._id!, {
        contaId: q.contaId, meio: q.meio, dataEfetivacao: q.data === this.hoje ? undefined : isoMeioDia(q.data),
        desconto: +q.desconto || 0, jurosMulta: +q.jurosMulta || 0, taxaBancaria: +q.taxaBancaria || 0,
      });
      this.toast.ok(`${q.titulo.natureza === 'ENTRADA' ? 'Recebimento' : 'Pagamento'} de ${this.brl(this.liquido(q))} registrado.`);
      this.liq.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.salvando.set(false); }
  }

  async cancelar(t: TransacaoFinanceira) {
    if (!confirm(`Cancelar o título "${t.descricao}" de ${this.brl(t.valorBruto)}? Ele fica no histórico como cancelado.`)) return;
    try {
      await this.api.cancelarTitulo(t._id!);
      this.toast.ok('Título cancelado.');
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
}
