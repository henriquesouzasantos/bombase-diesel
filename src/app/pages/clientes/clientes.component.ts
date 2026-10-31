import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { fmtBRL, fmtData } from '../../core/format';
import { Cliente } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

const vazio = (): Cliente => ({ tipo: 'PJ', nome: '', cpfCnpj: '', telefone: '', email: '', limiteCredito: 0, condicoesPagamento: '' });

@Component({
  selector: 'app-clientes',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">RF01 · Cadastros</p><h1 class="page-title mt-2">Clientes</h1>
        <p class="mt-1 text-sm text-muted">Pessoas físicas e jurídicas atendidas pela oficina</p></div>
      @if (auth.pode('RECEPCAO')) { <button type="button" class="btn-red" (click)="editar(null)"><app-icon name="mais" [size]="18" /> Novo cliente</button> }
    </div>

    <label class="relative mt-6 block max-w-md">
      <span class="sr-only">Buscar</span>
      <app-icon name="busca" [size]="18" class="absolute left-3 top-2.5 text-muted" />
      <input id="busca-clientes" class="input pl-10" placeholder="Buscar por nome ou CPF/CNPJ" [(ngModel)]="busca" (ngModelChange)="carregar()">
    </label>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[760px]">
        <thead><tr><th>Nome</th><th>Tipo</th><th>CPF/CNPJ</th><th>Telefone</th><th class="text-right">Limite de crédito</th><th>Desde</th><th></th></tr></thead>
        <tbody>
          @for (c of lista(); track c._id) {
            <tr>
              <td class="font-medium">{{ c.nome }}</td>
              <td><span class="pill-info">{{ c.tipo }}</span></td>
              <td class="whitespace-nowrap font-mono">{{ c.cpfCnpj }}</td>
              <td>{{ c.telefone || '—' }}</td>
              <td class="text-right font-mono">{{ brl(c.limiteCredito) }}</td>
              <td class="font-mono">{{ data(c.criadoEm) }}</td>
              <td class="text-right">@if (auth.pode('RECEPCAO')) { <button type="button" class="text-brand hover:underline" (click)="editar(c)" [attr.aria-label]="'Editar ' + c.nome"><app-icon name="editar" [size]="18" /></button> }</td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="py-10 text-center text-muted">Nenhum cliente encontrado.</td></tr>
          }
        </tbody>
      </table>
    </div>
    <p class="mt-2 text-xs text-muted">{{ lista().length }} cliente(s)</p>

    @if (form(); as f) {
      <app-modal [titulo]="f._id ? 'Editar cliente' : 'Novo cliente'" (fechar)="form.set(null)">
        <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar(f)">
          <fieldset class="flex gap-4 sm:col-span-2">
            <legend class="sr-only">Tipo de pessoa</legend>
            <label class="flex items-center gap-2 text-sm"><input type="radio" name="tipo" value="PJ" [(ngModel)]="f.tipo"> Pessoa jurídica</label>
            <label class="flex items-center gap-2 text-sm"><input type="radio" name="tipo" value="PF" [(ngModel)]="f.tipo"> Pessoa física</label>
          </fieldset>
          <label class="field sm:col-span-2"><span>{{ f.tipo === 'PJ' ? 'Razão social' : 'Nome completo' }}</span><input id="cli-nome" class="input" name="nome" [(ngModel)]="f.nome" required></label>
          <label class="field"><span>{{ f.tipo === 'PJ' ? 'CNPJ' : 'CPF' }}</span><input id="cli-doc" class="input font-mono" name="cpfCnpj" [(ngModel)]="f.cpfCnpj" required></label>
          <label class="field"><span>Telefone</span><input id="cli-tel" class="input" name="telefone" [(ngModel)]="f.telefone"></label>
          <label class="field sm:col-span-2"><span>E-mail</span><input id="cli-email" class="input" type="email" name="email" [(ngModel)]="f.email"></label>
          <label class="field"><span>Limite de crédito (R$)</span><input id="cli-limite" class="input font-mono" type="number" min="0" step="0.01" name="limite" [(ngModel)]="f.limiteCredito"></label>
          <label class="field"><span>Condições de pagamento</span><input id="cli-cond" class="input" name="cond" [(ngModel)]="f.condicoesPagamento" placeholder="28 dias · boleto"></label>
          <label class="flex items-start gap-2 text-sm text-muted sm:col-span-2">
            <input type="checkbox" name="lgpd" [(ngModel)]="consentimento" class="mt-1"> O cliente autorizou o tratamento dos dados (LGPD). Os dados serão anonimizados após o prazo fiscal de 5 anos.
          </label>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="salvando()">Salvar cliente</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class ClientesComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  lista = signal<Cliente[]>([]);
  form = signal<Cliente | null>(null);
  salvando = signal(false);
  busca = '';
  consentimento = false;
  brl = fmtBRL;
  data = fmtData;

  ngOnInit() { this.carregar(); }

  async carregar() {
    try { this.lista.set(await this.api.clientes(this.busca)); } catch (e) { this.toast.erro(mensagemErro(e)); }
  }

  editar(c: Cliente | null) {
    this.consentimento = !!c?.consentimentoLgpdEm;
    this.form.set(c ? { ...c } : vazio());
  }

  async salvar(f: Cliente) {
    if (!f.nome || !f.cpfCnpj) return this.toast.erro('Informe nome e CPF/CNPJ.');
    this.salvando.set(true);
    try {
      if (this.consentimento && !f.consentimentoLgpdEm) f.consentimentoLgpdEm = new Date().toISOString();
      await this.api.salvarCliente({ ...f, limiteCredito: +f.limiteCredito || 0 });
      this.toast.ok('Cliente salvo.');
      this.form.set(null);
      this.carregar();
    } catch (e) {
      this.toast.erro(mensagemErro(e));
    } finally {
      this.salvando.set(false);
    }
  }
}
