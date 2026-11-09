import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, mensagemErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PERFIS, Perfil, UsuarioAdmin } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';

/** RNF02: gestão de usuários e perfis de acesso. Só o administrador. */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="eyebrow">RNF02 · Controle de acesso</p><h1 class="page-title mt-2">Usuários</h1>
        <p class="mt-1 text-sm text-muted">Cada pessoa entra com o próprio e-mail. O perfil define o que ela pode fazer.</p></div>
      <button type="button" class="btn-red" (click)="novo()"><app-icon name="mais" [size]="18" /> Novo usuário</button>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-4">
      <label class="relative block w-full max-w-md">
        <span class="sr-only">Buscar</span>
        <app-icon name="busca" [size]="18" class="absolute left-3 top-2.5 text-muted" />
        <input id="busca-usuarios" class="input pl-10" placeholder="Nome ou e-mail" [ngModel]="busca()" (ngModelChange)="busca.set($event)">
      </label>
      <p class="text-sm text-muted">
        @for (c of contagem(); track c.perfil) { <span class="mr-3">{{ c.nome }}: <b class="font-mono text-ink">{{ c.qtd }}</b></span> }
      </p>
    </div>

    <div class="card mt-4 overflow-x-auto">
      <table class="tbl min-w-[720px]">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th></tr></thead>
        <tbody>
          @for (u of visiveis(); track u.uid) {
            <tr>
              <td class="font-medium">{{ u.nome }}@if (u.email === auth.user()?.email) { <span class="ml-2 text-xs text-muted">(você)</span> }</td>
              <td class="font-mono text-xs">{{ u.email }}</td>
              <td>
                <label class="sr-only" [attr.for]="'perfil-' + u.uid">Perfil de {{ u.nome }}</label>
                <select [id]="'perfil-' + u.uid" class="input !w-auto !py-1.5" [ngModel]="u.perfil" (ngModelChange)="mudar(u, $event)" [disabled]="u.email === auth.user()?.email">
                  @if (!u.perfil) { <option [ngValue]="null" disabled>Sem perfil</option> }
                  @for (p of perfis; track p[0]) { <option [ngValue]="p[0]">{{ p[1] }}</option> }
                </select>
              </td>
              <td>@if (u.desativado) { <span class="pill-bad">Desativado</span> } @else if (!u.perfil) { <span class="pill-warn">Sem perfil</span> } @else { <span class="pill-ok">Ativo</span> }</td>
            </tr>
          } @empty { <tr><td colspan="4" class="py-10 text-center text-muted">{{ carregando() ? 'Carregando…' : 'Nenhum usuário encontrado.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    <section class="card mt-6 p-5" aria-labelledby="perfis-titulo">
      <h2 id="perfis-titulo" class="flex items-center gap-2 font-display text-2xl italic uppercase text-ink"><app-icon name="escudo" /> O que cada perfil pode fazer</h2>
      <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        @for (r of regras; track r.p) { <div><dt class="font-semibold">{{ nomePerfil(r.p) }}</dt><dd class="text-muted">{{ r.d }}</dd></div> }
      </dl>
    </section>

    @if (form(); as f) {
      <app-modal titulo="Novo usuário" [largura]="480" (fechar)="form.set(null)">
        <form class="flex flex-col gap-4" (ngSubmit)="criar()">
          <label class="field"><span>Nome</span><input id="us-nome" class="input" name="nome" [(ngModel)]="f.nome" required minlength="2"></label>
          <label class="field"><span>E-mail</span><input id="us-email" class="input" type="email" name="email" [(ngModel)]="f.email" required></label>
          <label class="field"><span>Senha inicial</span><input id="us-senha" class="input font-mono" type="password" name="senha" [(ngModel)]="f.senha" required minlength="8" autocomplete="new-password">
            <small class="text-xs text-muted">Mínimo de 8 caracteres. Peça para a pessoa trocar no primeiro acesso.</small></label>
          <label class="field"><span>Perfil</span>
            <select id="us-perfil" class="input" name="perfil" [(ngModel)]="f.perfil">
              @for (p of perfis; track p[0]) { <option [value]="p[0]">{{ p[1] }}</option> }
            </select></label>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-ghost" (click)="form.set(null)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="salvando()">Criar usuário</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class UsuariosComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  auth = inject(AuthService);
  perfis = Object.entries(PERFIS) as [Perfil, string][];
  regras: { p: Perfil; d: string }[] = [
    { p: 'ADMIN', d: 'Tudo, inclusive usuários e perfis.' },
    { p: 'GERENTE_FINANCEIRO', d: 'Financeiro completo, conclusão e faturamento de OS. Consulta os cadastros.' },
    { p: 'RECEPCAO', d: 'Clientes, veículos, estoque, abertura e faturamento de OS.' },
    { p: 'TECNICO', d: 'Andamento das OS, requisição e baixa de peças, apontamento de horas.' },
  ];
  lista = signal<UsuarioAdmin[]>([]);
  busca = signal('');
  carregando = signal(true);
  salvando = signal(false);
  form = signal<{ nome: string; email: string; senha: string; perfil: Perfil } | null>(null);
  nomePerfil = (p: Perfil) => PERFIS[p];

  visiveis = computed(() => {
    const b = this.busca().trim().toLowerCase();
    return this.lista().filter((u) => !b || `${u.nome} ${u.email}`.toLowerCase().includes(b))
      .sort((a, z) => Number(!!a.desativado) - Number(!!z.desativado) || a.nome.localeCompare(z.nome));
  });
  contagem = computed(() => this.perfis.map(([perfil, nome]) => ({ perfil, nome, qtd: this.lista().filter((u) => u.perfil === perfil && !u.desativado).length })));

  ngOnInit() { this.carregar(); }

  async carregar() {
    try { this.lista.set(await this.api.usuarios()); } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.carregando.set(false); }
  }

  novo() { this.form.set({ nome: '', email: '', senha: '', perfil: 'TECNICO' }); }

  async criar() {
    this.salvando.set(true);
    try {
      await this.api.criarUsuario(this.form()!);
      this.toast.ok('Usuário criado.');
      this.form.set(null);
      this.carregar();
    } catch (e) { this.toast.erro(mensagemErro(e)); } finally { this.salvando.set(false); }
  }

  async mudar(u: UsuarioAdmin, perfil: Perfil) {
    const anterior = u.perfil;
    this.lista.update((l) => l.map((x) => (x.uid === u.uid ? { ...x, perfil } : x)));
    try {
      await this.api.mudarPerfil(u.uid, perfil);
      this.toast.ok(`${u.nome} agora é ${PERFIS[perfil]}. Vale a partir do próximo login.`);
    } catch (e) {
      this.lista.update((l) => l.map((x) => (x.uid === u.uid ? { ...x, perfil: anterior } : x)));
      this.toast.erro(mensagemErro(e));
    }
  }
}
