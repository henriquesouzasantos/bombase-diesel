import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtData } from '../../core/format';
import { OrdemServico, STATUS_OS, StatusOS, TRANSICOES_OS, Veiculo } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-os-quadro',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">RF07 · Oficina</p><h1 class="page-title mt-2">Quadro de OS</h1>
        <p class="mt-1 text-sm text-muted">Arraste os cards para mudar o status. Só as mudanças permitidas são aceitas.</p></div>
      @if (auth.pode('RECEPCAO')) { <button type="button" class="btn-red" (click)="abrirNova()"><app-icon name="mais" [size]="18" /> Nova OS</button> }
    </div>

    <div class="mt-6 grid auto-cols-[minmax(230px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
      @for (col of colunas(); track col.id) {
        <section class="flex min-h-[420px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition"
          [class.border-transparent]="!podeSoltar(col.id)" [class.bg-white]="!podeSoltar(col.id)"
          [class.border-brand]="podeSoltar(col.id)" [class.bg-brand-soft]="podeSoltar(col.id)"
          (dragover)="podeSoltar(col.id) && $event.preventDefault()" (drop)="soltar(col.id)" [attr.aria-label]="col.nome">
          <h2 class="flex items-center justify-between px-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">
            {{ col.nome }} <span class="rounded bg-canvas px-1.5 font-mono">{{ col.itens.length }}</span>
          </h2>
          @for (o of col.itens; track o._id) {
            <a [routerLink]="['/app/os', o._id]" draggable="true" (dragstart)="arrastando.set(o)" (dragend)="arrastando.set(null)"
              class="block cursor-grab rounded-lg border border-line bg-white p-3 text-sm shadow-sm hover:border-brand active:cursor-grabbing"
              [class.border-l-4]="true" [class.!border-l-bomb-red]="col.id === 'AGUARDANDO_PECAS'" [class.!border-l-ok]="col.id === 'CONCLUIDO' || col.id === 'FATURADO'">
              <span class="flex justify-between font-mono text-xs"><b class="font-medium text-brand">#{{ o.numero }}</b><span class="text-muted">{{ data(o.dataEntrada) }}</span></span>
              <span class="mt-1 block font-medium">{{ o.veiculoDescricao }}</span>
              <span class="block text-muted">{{ o.descricao }}</span>
              @if (o.tecnico) { <span class="mt-2 block text-xs text-muted">Técnico: {{ o.tecnico }}</span> }
            </a>
          }
        </section>
      }
    </div>

    @if (nova()) {
      <app-modal titulo="Nova OS" (fechar)="nova.set(false)">
        <form class="flex flex-col gap-4" (ngSubmit)="criar()">
          <label class="field"><span>Veículo</span>
            <select id="os-veiculo" class="input" name="veiculo" [(ngModel)]="novaVeiculo" required>
              <option value="" disabled>Selecione</option>
              @for (v of veiculos(); track v._id) { <option [value]="v._id">{{ v.placa }} · {{ v.marca }} {{ v.modelo }} · {{ v.clienteNome }}</option> }
            </select></label>
          <label class="field"><span>Serviço solicitado</span>
            <textarea id="os-desc" class="input min-h-24" name="desc" [(ngModel)]="novaDesc" required placeholder="Ex.: bomba injetora com perda de pressão"></textarea></label>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" (click)="nova.set(false)">Cancelar</button>
            <button type="submit" class="btn-primary">Abrir OS</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class OsQuadroComponent implements OnInit {
  /** ?nova=1 abre o formulário direto (atalho do painel). */
  nova_ = input<string | undefined>(undefined, { alias: 'nova' });
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  auth = inject(AuthService);
  ordens = signal<OrdemServico[]>([]);
  veiculos = signal<Veiculo[]>([]);
  arrastando = signal<OrdemServico | null>(null);
  nova = signal(false);
  novaVeiculo = '';
  novaDesc = '';
  data = fmtData;

  colunas = computed(() => STATUS_OS.map((s) => ({ ...s, itens: this.ordens().filter((o) => o.status === s.id) })));

  async ngOnInit() {
    await this.carregar();
    if (this.nova_()) this.abrirNova();
  }

  async carregar() {
    try { this.ordens.set(await this.api.ordens()); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  podeSoltar(destino: StatusOS) {
    const o = this.arrastando();
    return !!o && TRANSICOES_OS[o.status].includes(destino);
  }

  async soltar(destino: StatusOS) {
    const o = this.arrastando();
    this.arrastando.set(null);
    if (!o || !TRANSICOES_OS[o.status].includes(destino)) return;
    try {
      await this.api.mudarStatus(o._id!, destino);
      this.toast.ok(destino === 'FATURADO' ? `OS #${o.numero} faturada. O título a receber já está no financeiro.` : `OS #${o.numero} movida para ${STATUS_OS.find((s) => s.id === destino)!.nome}.`);
    } catch (e) {
      this.toast.erro(mensagemErro(e));
    }
    this.carregar();
  }

  async abrirNova() {
    if (!this.veiculos().length) this.veiculos.set(await this.api.veiculos());
    this.nova.set(true);
  }

  async criar() {
    if (!this.novaVeiculo || !this.novaDesc.trim()) return this.toast.erro('Escolha o veículo e descreva o serviço.');
    try {
      const o = await this.api.abrirOS({ veiculoId: this.novaVeiculo, descricao: this.novaDesc.trim() });
      this.toast.ok(`OS #${o.numero} aberta.`);
      this.nova.set(false);
      this.novaVeiculo = ''; this.novaDesc = '';
      this.router.navigate(['/app/os', o._id]);
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
}
