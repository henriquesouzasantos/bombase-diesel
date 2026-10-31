import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Auth, User } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Perfil, Usuario } from './models';

const DEMO_KEY = 'bombase.demo.user';

/**
 * Autenticação.
 * - Modo real: Firebase Auth (e-mail/senha). O perfil (RBAC) vem do custom claim `perfil`
 *   gravado pelo backend (functions/src/routes/usuarios.ts).
 * - Modo demo: qualquer e-mail entra, escolhendo o perfil na tela de login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<Usuario | null>(null);
  readonly ready = signal(false);
  readonly logado = computed(() => !!this.user());

  private auth?: Auth;
  private readyPromise: Promise<void>;

  constructor(private router: Router) {
    this.readyPromise = environment.demo ? this.initDemo() : this.initFirebase();
  }

  whenReady() {
    return this.readyPromise;
  }

  pode(...perfis: Perfil[]) {
    const u = this.user();
    return !!u && (u.perfil === 'ADMIN' || perfis.includes(u.perfil));
  }

  async login(email: string, senha: string, perfilDemo: Perfil = 'ADMIN') {
    if (environment.demo) {
      const nome = email.split('@')[0].replace(/[._]/g, ' ');
      const u: Usuario = { uid: 'demo-' + perfilDemo, email, nome: nome.charAt(0).toUpperCase() + nome.slice(1), perfil: perfilDemo };
      try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(u)); } catch { /* sem storage */ }
      this.user.set(u);
      return;
    }
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(this.auth!, email, senha);
    await this.carregarPerfil(this.auth!.currentUser!, true);
  }

  async recuperarSenha(email: string) {
    if (environment.demo) return;
    const { sendPasswordResetEmail } = await import('firebase/auth');
    await sendPasswordResetEmail(this.auth!, email);
  }

  async logout() {
    if (environment.demo) {
      try { sessionStorage.removeItem(DEMO_KEY); } catch { /* sem storage */ }
    } else {
      const { signOut } = await import('firebase/auth');
      await signOut(this.auth!);
    }
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  /** Token JWT do Firebase enviado à API no header Authorization (RNF01.2). */
  async token(): Promise<string | null> {
    if (environment.demo) return this.user() ? 'demo-' + this.user()!.perfil : null;
    return this.auth?.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  private async initDemo() {
    try {
      const raw = sessionStorage.getItem(DEMO_KEY);
      if (raw) this.user.set(JSON.parse(raw));
    } catch { /* sem storage */ }
    this.ready.set(true);
  }

  private async initFirebase() {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, onAuthStateChanged } = await import('firebase/auth');
    const app = initializeApp(environment.firebase);
    this.auth = getAuth(app);
    await new Promise<void>((resolve) => {
      onAuthStateChanged(this.auth!, async (fbUser) => {
        if (fbUser) await this.carregarPerfil(fbUser);
        else this.user.set(null);
        this.ready.set(true);
        resolve();
      });
    });
  }

  private async carregarPerfil(fbUser: User, forcar = false) {
    const res = await fbUser.getIdTokenResult(forcar);
    const perfil = (res.claims['perfil'] as Perfil) ?? 'TECNICO';
    this.user.set({ uid: fbUser.uid, email: fbUser.email ?? '', nome: fbUser.displayName ?? fbUser.email ?? '', perfil });
  }
}
