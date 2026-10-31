import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtNum } from '../../core/format';
import { Cliente, Veiculo } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const vazio = (): Veiculo => ({ clienteId: '', placa: '', chassi: '', marca: '', modelo: '', ano: new Date().getFullYear(), motor: '', hodometro: 0 });

@Component({
  selector: 'app-veiculos',
  imports: [FormsModule, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">RF02 · Cadastros</p><h1 class="page-title mt-2">Veículos</h1>
        <p class="mt-1 text-sm text-muted">Frota vinculada por chassi (VIN) e placa</p></div>
      @if (auth.pode('RECEPCAO')) { <button type="button" class="btn-red" (click)="editar(null)"><app-icon name="mais" [size]="18" /> Novo veículo</button> }
    </div>

    <label class="relative mt-6 block max-w-md">
      <span class="sr-only">Buscar</span>
      <app-icon name="busca" [size]="18" class="absolute left-3 top-2.5 text-muted" />
      <input id="busca-veiculos" class="input pl-10" placeholder="Placa, chassi, modelo ou cliente" [(ngModel)]="busca" (ngModelChange)="carregar()">
    </label>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[820px]">
        <thead><tr><th>Placa</th><th>Veículo</th><th>Chassi (VIN)</th><th>Motor</th><th class="text-right">Hodômetro</th><th>Cliente</th><th></th></tr></thead>
        <tbody>
          @for (v of lista(); track v._id) {
            <tr>
              <td><a class="font-mono font-medium text-brand hover:underline" [routerLink]="['/app/veiculos', v._id]">{{ v.placa }}</a></td>
              <td>{{ v.marca }} {{ v.modelo }} · {{ v.ano }}</td>
              <td class="font-mono text-xs">{{ v.chassi }}</td>
              <td>{{ v.motor || '—' }}</td>
              <td class="text-right font-mono">{{ num(v.hodometro) }} km</td>
              <td>{{ v.clienteNome }}</td>
              <td class="text-right">@if (auth.pode('RECEPCAO')) { <button type="button" class="text-brand" (click)="editar(v)" [attr.aria-label]="'Editar ' + v.placa"><app-icon name="editar" [size]="18" /></button> }</td>
            </tr>
          } @empty { <tr><td colspan="7" class="py-10 text-center text-muted">Nenhum veículo encontrado.</td></tr> }
        </tbody>
      </table>
    </div>

    @if (form(); as f) {
      <app-modal [titulo]="f._id ? 'Editar veículo' : 'Novo veículo'" (fechar)="form.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar(f)">
          <label class="field sm:col-span-2"><span>Cliente / frotista</span>
            <select id="vei-cliente" class="input" name="cliente" [(ngModel)]="f.clienteId" required>
              <option value="" disabled>Selecione</option>
              @for (c of clientes(); track c._id) { <option [value]="c._id">{{ c.nome }}</option> }
            </select></label>
          <label class="field"><span>Placa</span><input id="vei-placa" class="input font-mono uppercase" name="placa" [(ngModel)]="f.placa" required placeholder="ABC-1D23"></label>
          <label class="field"><span>Chassi (VIN)</span><input id="vei-chassi" class="input font-mono uppercase" name="chassi" [(ngModel)]="f.chassi" required maxlength="17"></label>
          <label class="field"><span>Marca</span><input id="vei-marca" class="input" name="marca" [(ngModel)]="f.marca" required></label>
          <label class="field"><span>Modelo</span><input id="vei-modelo" class="input" name="modelo" [(ngModel)]="f.modelo" required></label>
          <label class="field"><span>Ano</span><input id="vei-ano" class="input font-mono" type="number" name="ano" [(ngModel)]="f.ano"></label>
          <label class="field"><span>Motor</span><input id="vei-motor" class="input" name="motor" [(ngModel)]="f.motor" placeholder="DC13 450cv"></label>
          <label class="field"><span>Hodômetro (km)</span><input id="vei-hod" class="input font-mono" type="number" min="0" name="hod" [(ngModel)]="f.hodometro"></label>
          <label class="field"><span>Horímetro (h)</span><input id="vei-hor" class="input font-mono" type="number" min="0" name="hor" [(ngModel)]="f.horimetro"></label>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary">Salvar veículo</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class VeiculosComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  lista = signal<Veiculo[]>([]);
  clientes = signal<Cliente[]>([]);
  form = signal<Veiculo | null>(null);
  busca = '';
  num = fmtNum;

  ngOnInit() { this.carregar(); }

  async carregar() {
    try { this.lista.set(await this.api.veiculos(this.busca)); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  async editar(v: Veiculo | null) {
    if (!this.clientes().length) this.clientes.set(await this.api.clientes());
    this.form.set(v ? { ...v } : vazio());
  }

  async salvar(f: Veiculo) {
    try {
      const { clienteNome, ...dados } = f;
      await this.api.salvarVeiculo({ ...dados, placa: f.placa.toUpperCase(), chassi: f.chassi.toUpperCase(), ano: +f.ano, hodometro: +(f.hodometro ?? 0) });
      this.toast.ok('Veículo salvo.');
      this.form.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); }
  }
}
