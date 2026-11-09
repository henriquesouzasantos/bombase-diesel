import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Apontamento, Cliente, ContaBancaria, ItemOS, Liquidez, Meio, OrdemServico, Peca, Perfil, StatusOS, TipoTransacao,
  TransacaoFinanceira, UsuarioAdmin, Veiculo,
} from './models';

export interface FiltroExtrato {
  tipo?: string;
  status?: string;
  contaId?: string;
  de?: string;
  ate?: string;
  campo?: 'efetivacao' | 'vencimento';
  busca?: string;
}

export interface NovoLancamento {
  tipo: Exclude<TipoTransacao, 'ESTORNO'>;
  descricao: string;
  favorecido?: string;
  valorBruto: number;
  dataVencimento?: string;
  contaId?: string;
  meio?: Meio;
  taxaBancaria?: number;
}

export interface Liquidacao {
  contaId: string;
  meio: Meio;
  dataEfetivacao?: string;
  desconto: number;
  jurosMulta: number;
  taxaBancaria: number;
}

export interface Painel {
  osAbertas: number;
  osPorStatus: Record<StatusOS, number>;
  pecasAbaixoMinimo: Peca[];
  clientes: number;
  veiculos: number;
  faturadoMes: number;
  ultimasOS: OrdemServico[];
}

/** Cliente HTTP da API REST (functions/src/routes). Todos os métodos retornam Promise. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private get<T>(url: string) { return firstValueFrom(this.http.get<T>(this.base + url)); }
  private post<T>(url: string, body: unknown) { return firstValueFrom(this.http.post<T>(this.base + url, body)); }
  private put<T>(url: string, body: unknown) { return firstValueFrom(this.http.put<T>(this.base + url, body)); }
  private patch<T>(url: string, body: unknown) { return firstValueFrom(this.http.patch<T>(this.base + url, body)); }

  painel() { return this.get<Painel>('/painel'); }

  clientes(busca = '') { return this.get<Cliente[]>('/clientes?busca=' + encodeURIComponent(busca)); }
  cliente(id: string) { return this.get<Cliente>('/clientes/' + id); }
  salvarCliente(c: Cliente) { return c._id ? this.put<Cliente>('/clientes/' + c._id, c) : this.post<Cliente>('/clientes', c); }

  veiculos(busca = '') { return this.get<Veiculo[]>('/veiculos?busca=' + encodeURIComponent(busca)); }
  veiculo(id: string) { return this.get<Veiculo>('/veiculos/' + id); }
  historicoVeiculo(id: string) { return this.get<OrdemServico[]>('/veiculos/' + id + '/historico'); }
  salvarVeiculo(v: Veiculo) { return v._id ? this.put<Veiculo>('/veiculos/' + v._id, v) : this.post<Veiculo>('/veiculos', v); }

  pecas(busca = '') { return this.get<Peca[]>('/pecas?busca=' + encodeURIComponent(busca)); }
  salvarPeca(p: Peca) { return p._id ? this.put<Peca>('/pecas/' + p._id, p) : this.post<Peca>('/pecas', p); }
  entradaEstoque(id: string, quantidade: number, documento: string) {
    return this.post<Peca>(`/pecas/${id}/entrada`, { quantidade, documento });
  }

  ordens() { return this.get<OrdemServico[]>('/os'); }
  ordem(id: string) { return this.get<OrdemServico>('/os/' + id); }
  abrirOS(dados: { veiculoId: string; descricao: string }) { return this.post<OrdemServico>('/os', dados); }
  mudarStatus(id: string, status: StatusOS) { return this.patch<OrdemServico>(`/os/${id}/status`, { status }); }
  adicionarItem(id: string, pecaId: string, quantidade: number) { return this.post<OrdemServico>(`/os/${id}/itens`, { pecaId, quantidade }); }
  baixarItem(id: string, itemId: string) { return this.post<OrdemServico>(`/os/${id}/itens/${itemId}/baixa`, {}); }
  apontar(id: string, a: Omit<Apontamento, '_id' | 'horas'>) { return this.post<OrdemServico>(`/os/${id}/apontamentos`, a); }

  /* Financeiro (Entrega 2) */
  contas() { return this.get<ContaBancaria[]>('/financeiro/contas'); }
  salvarConta(c: ContaBancaria) { return c._id ? this.put<ContaBancaria>('/financeiro/contas/' + c._id, c) : this.post<ContaBancaria>('/financeiro/contas', c); }
  transacoes(f: FiltroExtrato = {}) {
    const q = Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    return this.get<TransacaoFinanceira[]>('/financeiro/transacoes' + (q ? '?' + q : ''));
  }
  lancar(d: NovoLancamento) { return this.post<TransacaoFinanceira>('/financeiro/transacoes', d); }
  liquidar(id: string, d: Liquidacao) { return this.post<TransacaoFinanceira>(`/financeiro/transacoes/${id}/liquidar`, d); }
  estornar(id: string) { return this.post<TransacaoFinanceira>(`/financeiro/transacoes/${id}/estornar`, {}); }
  cancelarTitulo(id: string) { return this.post<TransacaoFinanceira>(`/financeiro/transacoes/${id}/cancelar`, {}); }
  conciliar(id: string) { return this.post<TransacaoFinanceira>(`/financeiro/transacoes/${id}/conciliar`, {}); }
  liquidez() { return this.get<Liquidez>('/financeiro/liquidez'); }

  /* Usuários (RNF02, só administrador) */
  usuarios() { return this.get<UsuarioAdmin[]>('/usuarios'); }
  criarUsuario(d: { email: string; nome: string; senha: string; perfil: Perfil }) { return this.post<UsuarioAdmin>('/usuarios', d); }
  mudarPerfil(uid: string, perfil: Perfil) { return this.patch<{ uid: string; perfil: Perfil }>(`/usuarios/${uid}/perfil`, { perfil }); }
}

/** Extrai a mensagem de erro que a API devolve em { erro: string }. */
export function mensagemErro(e: unknown): string {
  if (e instanceof HttpErrorResponse) return e.error?.erro ?? `Falha na comunicação com o servidor (${e.status}).`;
  return e instanceof Error ? e.message : 'Erro inesperado.';
}

export type { ItemOS };
