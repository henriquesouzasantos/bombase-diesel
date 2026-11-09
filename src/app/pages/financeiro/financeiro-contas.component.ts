import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { fmtBRL } from '../../core/format';
import { ContaBancaria, TIPOS_CONTA, TipoConta } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const vazia = (): ContaBancaria => ({
  nomeBanco: '', agencia: '', numeroConta: '', tipo: 'BANCO', saldoAtual: 0, ativa: true, diasCompensacao: 1,
  taxasPadrao: { boleto: 0, cartaoPercentual: 0, pixPercentual: 0 },
});

/** RF10–RF12: contas bancárias, caixa e PIX, com taxas padrão (RNF02.4) e prazo de compensação. */
@Component({
  selector: 'app-financeiro-contas',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">Saldo consolidado das contas ativas: <b class="font-mono text-ink">{{ brl(total()) }}</b></p>
      <button type="button" class="btn-red" (click)="editar(null)"><app-icon name="mais" [size]="18" /> Nova conta</button>
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (c of lista(); track c._id) {
        <article class="card flex flex-col p-5" [class.opacity-60]="!c.ativa">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="eyebrow">{{ tipoNome(c.tipo) }}@if (!c.ativa) { · inativa }</p>
              <h2 class="mt-1 font-display text-2xl italic uppercase text-ink">{{ c.nomeBanco }}</h2>
              @if (c.agencia || c.numeroConta) { <p class="font-mono text-xs text-muted">Ag. {{ c.agencia || '—' }} · C/C {{ c.numeroConta || '—' }}</p> }
            </div>
            <button type="button" class="text-brand" (click)="editar(c)" [attr.aria-label]="'Editar ' + c.nomeBanco"><app-icon name="editar" [size]="18" /></button>
          </div>
          <p class="mt-4 font-mono text-2xl font-medium tabular-nums" [class.text-bad]="c.saldoAtual < 0">{{ brl(c.saldoAtual) }}</p>
          <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-3 text-xs">
            <dt class="text-muted">Compensação</dt><dd class="text-right font-mono">{{ c.diasCompensacao ? 'D+' + c.diasCompensacao + ' úteis' : 'na hora' }}</dd>
            <dt class="text-muted">Boleto</dt><dd class="text-right font-mono">{{ brl(c.taxasPadrao.boleto) }}</dd>
            <dt class="text-muted">Cartão</dt><dd class="text-right font-mono">{{ c.taxasPadrao.cartaoPercentual }}%</dd>
            <dt class="text-muted">PIX</dt><dd class="text-right font-mono">{{ c.taxasPadrao.pixPercentual }}%</dd>
          </dl>
          <a routerLink="../extrato" class="mt-4 text-sm font-medium text-brand hover:underline">Ver extrato</a>
        </article>
      } @empty {
        <p class="text-muted">{{ carregando() ? 'Carregando…' : 'Nenhuma conta cadastrada.' }}</p>
      }
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f._id ? 'Editar conta' : 'Nova conta'" (fechar)="form.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar(f)">
          <label class="field sm:col-span-2"><span>Banco / nome da conta</span><input id="ct-nome" class="input" name="nome" [(ngModel)]="f.nomeBanco" required placeholder="Banco do Brasil"></label>
          <label class="field"><span>Tipo</span>
            <select id="ct-tipo" class="input" name="tipo" [(ngModel)]="f.tipo">
              @for (t of tipos; track t[0]) { <option [value]="t[0]">{{ t[1] }}</option> }
            </select></label>
          <label class="field"><span>Compensação (dias úteis)</span><input id="ct-dias" class="input font-mono" type="number" min="0" max="30" name="dias" [(ngModel)]="f.diasCompensacao"></label>
          @if (f.tipo !== 'CAIXA') {
            <label class="field"><span>Agência</span><input id="ct-ag" class="input font-mono" name="ag" [(ngModel)]="f.agencia"></label>
            <label class="field"><span>Conta</span><input id="ct-cc" class="input font-mono" name="cc" [(ngModel)]="f.numeroConta"></label>
          }
          <fieldset class="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-3">
            <legend class="px-1 text-sm font-medium text-muted">Taxas padrão (sugeridas na liquidação)</legend>
            <label class="field"><span>Boleto (R$)</span><input id="ct-tx-bol" class="input font-mono" type="number" step="0.01" min="0" name="txb" [(ngModel)]="f.taxasPadrao.boleto"></label>
            <label class="field"><span>Cartão (%)</span><input id="ct-tx-car" class="input font-mono" type="number" step="0.01" min="0" name="txc" [(ngModel)]="f.taxasPadrao.cartaoPercentual"></label>
            <label class="field"><span>PIX (%)</span><input id="ct-tx-pix" class="input font-mono" type="number" step="0.01" min="0" name="txp" [(ngModel)]="f.taxasPadrao.pixPercentual"></label>
          </fieldset>
          @if (!f._id) {
            <label class="field"><span>Saldo inicial (R$)</span><input id="ct-saldo" class="input font-mono" type="number" step="0.01" name="saldo" [(ngModel)]="f.saldoAtual"></label>
            <p class="self-end text-xs text-muted">Depois de criada, o saldo só muda por lançamentos.</p>
          }
          <label class="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="ativa" [(ngModel)]="f.ativa"> Conta ativa</label>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="salvando()">Salvar conta</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class FinanceiroContasComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  tipos = Object.entries(TIPOS_CONTA) as [TipoConta, string][];
  lista = signal<ContaBancaria[]>([]);
  form = signal<ContaBancaria | null>(null);
  carregando = signal(true);
  salvando = signal(false);
  total = computed(() => this.lista().filter((c) => c.ativa).reduce((s, c) => s + c.saldoAtual, 0));
  brl = fmtBRL;
  tipoNome = (t: TipoConta) => TIPOS_CONTA[t];

  ngOnInit() { this.carregar(); }

  async carregar() {
    try { this.lista.set(await this.api.contas()); } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.carregando.set(false); }
  }

  editar(c: ContaBancaria | null) {
    this.form.set(c ? { ...c, taxasPadrao: { ...vazia().taxasPadrao, ...c.taxasPadrao } } : vazia());
  }

  async salvar(f: ContaBancaria) {
    this.salvando.set(true);
    try {
      const t = f.taxasPadrao;
      await this.api.salvarConta({
        ...f, saldoAtual: +f.saldoAtual || 0, diasCompensacao: +f.diasCompensacao || 0,
        taxasPadrao: { boleto: +t.boleto || 0, cartaoPercentual: +t.cartaoPercentual || 0, pixPercentual: +t.pixPercentual || 0 },
      });
      this.toast.ok('Conta salva.');
      this.form.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.salvando.set(false); }
  }
}
