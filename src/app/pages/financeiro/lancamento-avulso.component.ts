import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, mensagemErro } from '../../core/api.service';
import { fmtBRL } from '../../core/format';
import { ContaBancaria, MEIOS, Meio, taxaSugerida, valorEfetivo } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { ModalComponent } from '../../shared/modal.component';

/** RF13: lançamento avulso (PIX, dinheiro, TED…) que entra ou sai da conta na hora. */
@Component({
  selector: 'app-lancamento-avulso',
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal titulo="Lançamento avulso" [largura]="520" (fechar)="fechar.emit()">
      <form class="grid gap-4 sm:grid-cols-2" (ngSubmit)="salvar()">
        <fieldset class="flex gap-2 sm:col-span-2">
          <legend class="sr-only">Direção</legend>
          @for (o of [{ v: 'AVULSO_ENTRADA', t: 'Entrada' }, { v: 'AVULSO_SAIDA', t: 'Saída' }]; track o.v) {
            <label class="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold"
              [class]="f.tipo === o.v ? (o.v === 'AVULSO_ENTRADA' ? 'border-ok bg-ok/10 text-ok' : 'border-bad bg-bad/10 text-bad') : 'border-line text-muted'">
              <input class="sr-only" type="radio" name="tipo" [value]="o.v" [(ngModel)]="f.tipo" (ngModelChange)="sugerir()"> {{ o.t }}
            </label>
          }
        </fieldset>
        <label class="field sm:col-span-2"><span>Descrição</span><input id="av-desc" class="input" name="desc" [(ngModel)]="f.descricao" required placeholder="Ex.: calibração avulsa, compra de material"></label>
        <label class="field sm:col-span-2"><span>{{ f.tipo === 'AVULSO_ENTRADA' ? 'Recebido de' : 'Pago a' }}</span><input id="av-fav" class="input" name="fav" [(ngModel)]="f.favorecido"></label>
        <label class="field"><span>Conta</span>
          <select id="av-conta" class="input" name="conta" [(ngModel)]="f.contaId" (ngModelChange)="sugerir()" required>
            @for (c of contas(); track c._id) { <option [value]="c._id">{{ c.nomeBanco }}</option> }
          </select></label>
        <label class="field"><span>Meio</span>
          <select id="av-meio" class="input" name="meio" [(ngModel)]="f.meio" (ngModelChange)="sugerir()">
            @for (m of meios; track m[0]) { <option [value]="m[0]">{{ m[1] }}</option> }
          </select></label>
        <label class="field"><span>Valor (R$)</span><input id="av-valor" class="input font-mono" type="number" step="0.01" min="0.01" name="valor" [(ngModel)]="f.valorBruto" (ngModelChange)="sugerir()" required></label>
        <label class="field"><span>Taxa bancária (R$)</span><input id="av-taxa" class="input font-mono" type="number" step="0.01" min="0" name="taxa" [(ngModel)]="f.taxaBancaria"></label>
        <p class="rounded-lg bg-brand-soft p-3 text-sm text-brand sm:col-span-2">
          {{ f.tipo === 'AVULSO_ENTRADA' ? 'Entra na conta' : 'Sai da conta' }}: <b class="font-mono">{{ brl(liquido()) }}</b>
        </p>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <button type="button" class="btn-ghost" (click)="fechar.emit()">Cancelar</button>
          <button type="submit" class="btn-primary" [disabled]="salvando()">Lançar</button>
        </div>
      </form>
    </app-modal>
  `,
})
export class LancamentoAvulsoComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  contas = input.required<ContaBancaria[]>();
  fechar = output<void>();
  salvo = output<void>();
  salvando = signal(false);
  meios = Object.entries(MEIOS) as [Meio, string][];
  brl = fmtBRL;
  f = { tipo: 'AVULSO_ENTRADA' as 'AVULSO_ENTRADA' | 'AVULSO_SAIDA', descricao: '', favorecido: '', contaId: '', meio: 'PIX' as Meio, valorBruto: 0, taxaBancaria: 0 };

  ngOnInit() { this.f.contaId = this.contas().find((c) => c.ativa)?._id ?? ''; }

  sugerir() { this.f.taxaBancaria = taxaSugerida(this.contas().find((c) => c._id === this.f.contaId), this.f.meio, +this.f.valorBruto || 0); }

  liquido() { return valorEfetivo(this.f.tipo === 'AVULSO_ENTRADA' ? 'ENTRADA' : 'SAIDA', +this.f.valorBruto || 0, 0, 0, +this.f.taxaBancaria || 0); }

  async salvar() {
    this.salvando.set(true);
    try {
      await this.api.lancar({ ...this.f, valorBruto: +this.f.valorBruto, taxaBancaria: +this.f.taxaBancaria });
      this.toast.ok('Lançamento registrado.');
      this.salvo.emit();
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.salvando.set(false); }
  }
}
