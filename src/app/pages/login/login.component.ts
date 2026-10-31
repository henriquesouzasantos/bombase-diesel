import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { PERFIS, Perfil } from '../../core/models';
import { ToastService } from '../../core/toast.component';
import { LogoComponent } from '../../shared/logo.component';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, LogoComponent],
  template: `
    <div class="grid min-h-screen place-items-center bg-xr-bg px-4 py-10"
      style="background-image:radial-gradient(ellipse 70% 55% at 50% 40%,rgba(15,71,145,.45),transparent 70%),linear-gradient(rgba(127,227,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(127,227,255,.06) 1px,transparent 1px);background-size:auto,40px 40px,40px 40px">
      <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <a routerLink="/" aria-label="Página inicial"><app-logo /></a>
        <h1 class="mt-8 font-display text-4xl italic uppercase text-brand">{{ modo() === 'login' ? 'Entrar' : 'Recuperar senha' }}</h1>

        @if (modo() === 'login') {
          <form class="mt-6 flex flex-col gap-4" (ngSubmit)="entrar()">
            <label class="field"><span>E-mail</span>
              <input id="email" class="input" type="email" name="email" [(ngModel)]="email" required autocomplete="username"></label>
            <label class="field"><span>Senha</span>
              <input id="senha" class="input" type="password" name="senha" [(ngModel)]="senha" [required]="!demo" autocomplete="current-password"></label>
            @if (demo) {
              <label class="field"><span>Perfil (demonstração)</span>
                <select id="perfil" class="input" name="perfil" [(ngModel)]="perfil">
                  @for (p of perfisLista; track p[0]) { <option [value]="p[0]">{{ p[1] }}</option> }
                </select></label>
              <p class="rounded-lg bg-brand-soft p-3 text-xs text-brand">Modo demonstração: qualquer e-mail entra. A senha não é verificada.</p>
            }
            <button class="btn-primary mt-2 py-3" type="submit" [disabled]="carregando()">{{ carregando() ? 'Entrando…' : 'Entrar' }}</button>
            <button type="button" class="text-sm font-medium text-brand hover:underline" (click)="modo.set('recuperar')">Esqueci minha senha</button>
          </form>
        } @else {
          <form class="mt-6 flex flex-col gap-4" (ngSubmit)="recuperar()">
            <p class="text-sm text-muted">Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.</p>
            <label class="field"><span>E-mail</span><input id="email-rec" class="input" type="email" name="email" [(ngModel)]="email" required></label>
            <button class="btn-primary py-3" type="submit">Enviar link</button>
            <button type="button" class="text-sm font-medium text-brand hover:underline" (click)="modo.set('login')">Voltar para o login</button>
          </form>
        }
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  demo = environment.demo;
  perfisLista = Object.entries(PERFIS) as [Perfil, string][];
  email = environment.demo ? 'henrique@bombase.com.br' : '';
  senha = '';
  perfil: Perfil = 'ADMIN';
  carregando = signal(false);
  modo = signal<'login' | 'recuperar'>('login');

  async entrar() {
    if (!this.email) return this.toast.erro('Informe o e-mail.');
    this.carregando.set(true);
    try {
      await this.auth.login(this.email, this.senha, this.perfil);
      this.router.navigateByUrl('/app/painel');
    } catch {
      this.toast.erro('E-mail ou senha incorretos.');
    } finally {
      this.carregando.set(false);
    }
  }

  async recuperar() {
    try {
      await this.auth.recuperarSenha(this.email);
      this.toast.ok('Se o e-mail estiver cadastrado, o link chega em alguns minutos.');
      this.modo.set('login');
    } catch {
      this.toast.erro('Não foi possível enviar o link. Confira o e-mail.');
    }
  }
}
