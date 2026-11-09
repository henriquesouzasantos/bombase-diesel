import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtBRL, fmtData } from '../../core/format';
import { OrdemServico, Peca, STATUS_OS, StatusOS, TRANSICOES_OS, pendenciasRN01, totalOS } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { StatusPillComponent } from '../../shared/status-pill.component';

@Component({
  selector: 'app-os-detalhe',
  imports: [FormsModule, RouterLink, IconComponent, StatusPillComponent],
  template: `
    <a routerLink="/app/os" class="inline-flex items-center gap-1 text-sm text-brand hover:underline"><app-icon name="voltar" [size]="16" /> Quadro de OS</a>
    @if (os(); as o) {
      <div class="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="eyebrow">Ordem de serviço · entrada {{ data(o.dataEntrada) }}</p>
          <h1 class="page-title mt-2">OS #{{ o.numero }}</h1>
          <p class="mt-1 text-sm text-muted">{{ o.veiculoDescricao }} · {{ o.clienteNome }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <app-status-pill [status]="o.status" />
          @for (s of proximos(); track s) {
            <button type="button" [class]="s === 'CONCLUIDO' || s === 'FATURADO' ? 'btn-red' : 'btn-ghost'" (click)="mover(s)">{{ nomeStatus(s) }}</button>
          }
        </div>
      </div>

      @if (pendencias().length && (o.status === 'QUALIDADE' || o.status === 'EM_ANDAMENTO')) {
        <p class="mt-4 flex items-center gap-2 rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
          <app-icon name="alerta" [size]="18" /> Faturamento bloqueado: {{ pendencias().length }} peça(s) sem baixa física no estoque (RN01).
        </p>
      }

      <p class="card mt-6 p-5 text-sm"><span class="eyebrow block">Serviço</span><span class="mt-1 block text-base">{{ o.descricao }}</span></p>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section class="card overflow-x-auto">
          <h2 class="px-5 pt-5 font-display text-2xl italic uppercase">Peças aplicadas</h2>
          <table class="tbl mt-3 min-w-[560px]">
            <thead><tr><th>SKU</th><th>Peça</th><th class="text-right">Qtd</th><th class="text-right">Unitário</th><th class="text-right">Total</th><th>Baixa física</th></tr></thead>
            <tbody>
              @for (i of o.itens; track i._id) {
                <tr>
                  <td class="font-mono">{{ i.sku }}</td><td>{{ i.descricao }}</td>
                  <td class="text-right font-mono">{{ i.quantidade }}</td>
                  <td class="text-right font-mono">{{ brl(i.precoUnitario) }}</td>
                  <td class="text-right font-mono">{{ brl(i.quantidade * i.precoUnitario) }}</td>
                  <td>
                    @if (i.baixado) { <span class="pill-ok">Baixado</span> }
                    @else if (editavel()) { <button type="button" class="text-sm font-semibold text-bomb-red hover:underline" (click)="baixar(i._id!)">Dar baixa</button> }
                    @else { <span class="pill-bad">Pendente</span> }
                  </td>
                </tr>
              } @empty { <tr><td colspan="6" class="py-6 text-center text-muted">Nenhuma peça lançada.</td></tr> }
            </tbody>
          </table>
          @if (editavel()) {
            <form class="flex flex-wrap items-end gap-3 p-5" (ngSubmit)="addItem()">
              <label class="field min-w-[220px] flex-1"><span>Peça</span>
                <select id="item-peca" class="input" name="peca" [(ngModel)]="itemPeca" required>
                  <option value="" disabled>Selecione</option>
                  @for (p of pecas(); track p._id) { <option [value]="p._id">{{ p.sku }} · {{ p.descricao }} (saldo {{ p.saldo }})</option> }
                </select></label>
              <label class="field w-24"><span>Qtd</span><input id="item-qtd" class="input font-mono" type="number" min="1" name="qtd" [(ngModel)]="itemQtd"></label>
              <button type="submit" class="btn-primary">Adicionar</button>
            </form>
          }
        </section>

        <section class="card p-5">
          <h2 class="font-display text-2xl italic uppercase">Apontamento de horas</h2>
          <ul class="mt-3 divide-y divide-line text-sm">
            @for (a of o.apontamentos; track a._id) {
              <li class="flex justify-between gap-3 py-2"><span>{{ a.tecnico }} · <span class="font-mono">{{ a.inicio }}–{{ a.fim }}</span></span><span class="font-mono">{{ a.horas }} h</span></li>
            } @empty { <li class="py-2 text-muted">Sem horas apontadas.</li> }
          </ul>
          @if (editavel()) {
            <form class="mt-4 grid grid-cols-2 gap-3" (ngSubmit)="apontar()">
              <label class="field col-span-2"><span>Técnico</span><input id="ap-tec" class="input" name="tec" [(ngModel)]="ap.tecnico" required></label>
              <label class="field"><span>Início</span><input id="ap-ini" class="input font-mono" type="time" name="ini" [(ngModel)]="ap.inicio" required></label>
              <label class="field"><span>Fim</span><input id="ap-fim" class="input font-mono" type="time" name="fim" [(ngModel)]="ap.fim" required></label>
              <label class="field col-span-2"><span>Valor da hora (R$)</span><input id="ap-vh" class="input font-mono" type="number" min="0" name="vh" [(ngModel)]="ap.valorHora"></label>
              <button type="submit" class="btn-primary col-span-2">Registrar horas</button>
            </form>
          }
        </section>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section class="card p-5">
          <h2 class="font-display text-2xl italic uppercase">Histórico</h2>
          <ol class="mt-3 flex flex-col gap-2 text-sm">
            @for (h of o.historico; track $index) {
              <li class="flex gap-3"><span class="font-mono text-muted">{{ data(h.em) }}</span><span>{{ nomeStatus(h.status) }}</span><span class="text-muted">· {{ h.por }}</span></li>
            }
          </ol>
        </section>
        <section class="card p-5">
          <h2 class="font-display text-2xl italic uppercase">Total da OS</h2>
          <dl class="mt-3 text-sm">
            <div class="flex justify-between border-b border-dashed border-line py-2"><dt>Peças</dt><dd class="font-mono">{{ brl(totais().pecas) }}</dd></div>
            <div class="flex justify-between border-b border-dashed border-line py-2"><dt>Mão de obra</dt><dd class="font-mono">{{ brl(totais().maoDeObra) }}</dd></div>
            <div class="flex justify-between pt-3 text-base font-semibold"><dt>Total</dt><dd class="font-mono text-ok">{{ brl(totais().total) }}</dd></div>
          </dl>
        </section>
      </div>
    }
  `,
})
export class OsDetalheComponent implements OnInit {
  id = input.required<string>();
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  os = signal<OrdemServico | null>(null);
  pecas = signal<Peca[]>([]);
  itemPeca = '';
  itemQtd = 1;
  ap = { tecnico: '', inicio: '08:00', fim: '10:00', valorHora: 180 };
  brl = fmtBRL; data = fmtData;

  totais = computed(() => (this.os() ? totalOS(this.os()!) : { pecas: 0, maoDeObra: 0, total: 0 }));
  pendencias = computed(() => (this.os() ? pendenciasRN01(this.os()!) : []));
  proximos = computed(() => (this.os() ? TRANSICOES_OS[this.os()!.status] : []));
  editavel = computed(() => !!this.os() && !['CONCLUIDO', 'FATURADO'].includes(this.os()!.status) && this.auth.pode('RECEPCAO', 'TECNICO'));
  nomeStatus = (s: StatusOS) => STATUS_OS.find((x) => x.id === s)!.nome;

  async ngOnInit() {
    this.ap.tecnico = this.auth.user()?.nome ?? '';
    try {
      const [o, p] = await Promise.all([this.api.ordem(this.id()), this.api.pecas()]);
      this.os.set(o); this.pecas.set(p);
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  private async exec(fn: () => Promise<OrdemServico>, ok: string) {
    try { this.os.set(await fn()); this.toast.ok(ok); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  mover(s: StatusOS) {
    const msg = s === 'FATURADO' ? 'OS faturada. O título a receber já está no financeiro.' : `Status alterado para ${this.nomeStatus(s)}.`;
    return this.exec(() => this.api.mudarStatus(this.id(), s), msg);
  }

  async addItem() {
    if (!this.itemPeca) return this.toast.erro('Escolha a peça.');
    await this.exec(() => this.api.adicionarItem(this.id(), this.itemPeca, +this.itemQtd), 'Peça adicionada. Falta dar baixa no estoque.');
    this.itemPeca = ''; this.itemQtd = 1;
  }

  async baixar(itemId: string) {
    await this.exec(() => this.api.baixarItem(this.id(), itemId), 'Baixa registrada no estoque.');
    this.pecas.set(await this.api.pecas());
  }

  apontar() { return this.exec(() => this.api.apontar(this.id(), { ...this.ap, valorHora: +this.ap.valorHora }), 'Horas registradas.'); }
}
