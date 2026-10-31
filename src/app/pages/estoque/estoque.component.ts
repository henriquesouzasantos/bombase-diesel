import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtBRL } from '../../core/format';
import { Peca, precoVenda } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const vazia = (): Peca => ({ sku: '', descricao: '', unidade: 'UN', custo: 0, margem: 30, precoVenda: 0, saldo: 0, estoqueMinimo: 0, localizacao: '' });

@Component({
  selector: 'app-estoque',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">RF04 · RF05 · Estoque</p><h1 class="page-title mt-2">Estoque de peças</h1>
        <p class="mt-1 text-sm text-muted">Baixa automática pela OS e alerta de estoque mínimo</p></div>
      @if (auth.pode('RECEPCAO')) { <button type="button" class="btn-red" (click)="editar(null)"><app-icon name="mais" [size]="18" /> Nova peça</button> }
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-4">
      <label class="relative block w-full max-w-md">
        <span class="sr-only">Buscar</span>
        <app-icon name="busca" [size]="18" class="absolute left-3 top-2.5 text-muted" />
        <input id="busca-pecas" class="input pl-10" placeholder="SKU ou descrição" [(ngModel)]="busca" (ngModelChange)="carregar()">
      </label>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" [(ngModel)]="soAlertas" name="alertas"> Só abaixo do mínimo ({{ alertas() }})</label>
    </div>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[900px]">
        <thead><tr><th>SKU</th><th>Descrição</th><th>Local</th><th class="text-right">Custo</th><th class="text-right">Margem</th><th class="text-right">Preço</th><th class="text-right">Saldo / mín</th><th>Situação</th><th></th></tr></thead>
        <tbody>
          @for (p of visiveis(); track p._id) {
            <tr>
              <td class="font-mono font-medium">{{ p.sku }}</td>
              <td>{{ p.descricao }}</td>
              <td class="text-muted">{{ p.localizacao || '—' }}</td>
              <td class="text-right font-mono">{{ brl(p.custo) }}</td>
              <td class="text-right font-mono">{{ p.margem }}%</td>
              <td class="text-right font-mono">{{ brl(p.precoVenda) }}</td>
              <td class="text-right font-mono">{{ p.saldo }} / {{ p.estoqueMinimo }} {{ p.unidade }}</td>
              <td>
                @if (p.saldo < p.estoqueMinimo) { <span class="pill-bad">Abaixo do mínimo</span> }
                @else if (p.saldo <= p.estoqueMinimo * 1.2) { <span class="pill-warn">Baixo</span> }
                @else { <span class="pill-ok">OK</span> }
              </td>
              <td class="whitespace-nowrap text-right">
                @if (auth.pode('RECEPCAO')) {
                  <button type="button" class="mr-3 text-sm font-medium text-brand hover:underline" (click)="entrada.set({ peca: p, qtd: 1, doc: '' })">Entrada</button>
                  <button type="button" class="text-brand" (click)="editar(p)" [attr.aria-label]="'Editar ' + p.sku"><app-icon name="editar" [size]="18" /></button>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="9" class="py-10 text-center text-muted">Nenhuma peça encontrada.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f._id ? 'Editar peça' : 'Nova peça'" (fechar)="form.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar(f)">
          <label class="field"><span>SKU</span><input id="pc-sku" class="input font-mono uppercase" name="sku" [(ngModel)]="f.sku" required></label>
          <label class="field"><span>Unidade</span>
            <select id="pc-un" class="input" name="un" [(ngModel)]="f.unidade">@for (u of ['UN','KT','L','JG','M']; track u) { <option>{{ u }}</option> }</select></label>
          <label class="field sm:col-span-2"><span>Descrição</span><input id="pc-desc" class="input" name="desc" [(ngModel)]="f.descricao" required></label>
          <label class="field"><span>Custo (R$)</span><input id="pc-custo" class="input font-mono" type="number" step="0.01" min="0" name="custo" [(ngModel)]="f.custo"></label>
          <label class="field"><span>Margem (%)</span><input id="pc-margem" class="input font-mono" type="number" step="0.1" min="0" name="margem" [(ngModel)]="f.margem"></label>
          <p class="rounded-lg bg-brand-soft p-3 text-sm text-brand sm:col-span-2">Preço de venda calculado: <b class="font-mono">{{ brl(preco(f)) }}</b></p>
          @if (!f._id) { <label class="field"><span>Saldo inicial</span><input id="pc-saldo" class="input font-mono" type="number" min="0" name="saldo" [(ngModel)]="f.saldo"></label> }
          <label class="field"><span>Estoque mínimo</span><input id="pc-min" class="input font-mono" type="number" min="0" name="min" [(ngModel)]="f.estoqueMinimo"></label>
          <label class="field"><span>Localização</span><input id="pc-loc" class="input" name="loc" [(ngModel)]="f.localizacao" placeholder="Gaveta C1"></label>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary">Salvar peça</button>
          </div>
        </form>
      </app-modal>
    }

    @if (entrada(); as e) {
      <app-modal titulo="Entrada no estoque" [largura]="440" (fechar)="entrada.set(null)">
        <form class="flex flex-col gap-4" (ngSubmit)="confirmarEntrada()">
          <p class="text-sm"><b class="font-mono">{{ e.peca.sku }}</b> · {{ e.peca.descricao }} · saldo atual {{ e.peca.saldo }} {{ e.peca.unidade }}</p>
          <label class="field"><span>Quantidade</span><input id="ent-qtd" class="input font-mono" type="number" min="1" name="qtd" [(ngModel)]="e.qtd" required></label>
          <label class="field"><span>Documento (NF-e)</span><input id="ent-doc" class="input font-mono" name="doc" [(ngModel)]="e.doc" placeholder="NF 18.442"></label>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" (click)="entrada.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary">Registrar entrada</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class EstoqueComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  lista = signal<Peca[]>([]);
  form = signal<Peca | null>(null);
  entrada = signal<{ peca: Peca; qtd: number; doc: string } | null>(null);
  busca = '';
  private filtroAlerta = signal(false);
  get soAlertas() { return this.filtroAlerta(); }
  set soAlertas(v: boolean) { this.filtroAlerta.set(v); }
  alertas = computed(() => this.lista().filter((p) => p.saldo < p.estoqueMinimo).length);
  visiveis = computed(() => (this.filtroAlerta() ? this.lista().filter((p) => p.saldo < p.estoqueMinimo) : this.lista()));
  brl = fmtBRL;
  preco = (f: Peca) => precoVenda(+f.custo || 0, +f.margem || 0);

  ngOnInit() { this.carregar(); }

  async carregar() {
    try { this.lista.set(await this.api.pecas(this.busca)); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  editar(p: Peca | null) { this.form.set(p ? { ...p } : vazia()); }

  async salvar(f: Peca) {
    try {
      await this.api.salvarPeca({ ...f, sku: f.sku.toUpperCase(), custo: +f.custo, margem: +f.margem, saldo: +f.saldo, estoqueMinimo: +f.estoqueMinimo, precoVenda: this.preco(f) });
      this.toast.ok('Peça salva.');
      this.form.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  async confirmarEntrada() {
    const e = this.entrada()!;
    try {
      await this.api.entradaEstoque(e.peca._id!, +e.qtd, e.doc);
      this.toast.ok(`Entrada de ${e.qtd} ${e.peca.unidade} registrada.`);
      this.entrada.set(null);
      this.carregar();
    } catch (err) { this.toast.erro(mensagemErro(err)); }
  }
}
