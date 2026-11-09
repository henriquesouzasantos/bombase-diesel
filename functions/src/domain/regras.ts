import { createHash } from 'node:crypto';

/** Regras de negócio puras (sem banco), fáceis de testar. Espelham src/app/core/models.ts. */

export type StatusOS = 'ABERTO' | 'EM_ANDAMENTO' | 'AGUARDANDO_PECAS' | 'QUALIDADE' | 'CONCLUIDO' | 'FATURADO';

/** Diagrama de estados 7.4. */
export const TRANSICOES_OS: Record<StatusOS, StatusOS[]> = {
  ABERTO: ['EM_ANDAMENTO'],
  EM_ANDAMENTO: ['AGUARDANDO_PECAS', 'QUALIDADE'],
  AGUARDANDO_PECAS: ['EM_ANDAMENTO'],
  QUALIDADE: ['EM_ANDAMENTO', 'CONCLUIDO'],
  CONCLUIDO: ['FATURADO'],
  FATURADO: [],
};

export const podeMudar = (de: StatusOS, para: StatusOS) => TRANSICOES_OS[de]?.includes(para) ?? false;

export const centavos = (v: number) => Math.round(v * 100) / 100;

export function totalOS(os: { itens: { quantidade: number; precoUnitario: number }[]; apontamentos: { horas: number; valorHora: number }[] }) {
  const pecas = os.itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
  const maoDeObra = os.apontamentos.reduce((s, a) => s + a.horas * a.valorHora, 0);
  return { pecas: centavos(pecas), maoDeObra: centavos(maoDeObra), total: centavos(pecas + maoDeObra) };
}

/** RN01: itens sem baixa física bloqueiam conclusão e faturamento. */
export const pendenciasRN01 = <T extends { baixado: boolean }>(itens: T[]) => itens.filter((i) => !i.baixado);

export const precoVenda = (custo: number, margem: number) => centavos(custo * (1 + margem / 100));

/** "08:10" → "10:40" = 2,5 h */
export function horasEntre(inicio: string, fim: string) {
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fim.split(':').map(Number);
  return centavos((h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
}

/** RN02: Valor líquido = Bruto − Desconto + Juros/Multa − Taxa bancária. */
export const valorLiquido = (bruto: number, desconto: number, jurosMulta: number, taxa: number) =>
  centavos(bruto - desconto + jurosMulta - taxa);

/** Multa fixa + juros simples ao dia sobre o bruto. Ex.: 2% + 0,033%/dia. */
export function jurosMultaAtraso(bruto: number, diasAtraso: number, multaPct = 2, jurosDiaPct = 0.033) {
  if (diasAtraso <= 0) return 0;
  return centavos(bruto * (multaPct / 100) + bruto * (jurosDiaPct / 100) * diasAtraso);
}

/** RNF02.2 / RN03: hash SHA-256 encadeado (cada registro inclui o hash do anterior). */
export function hashRegistro(dados: Record<string, unknown>, hashAnterior = '') {
  const canonico = JSON.stringify(Object.keys(dados).sort().reduce((o, k) => ({ ...o, [k]: dados[k] }), {}));
  return createHash('sha256').update(hashAnterior + canonico).digest('hex');
}

/* ---------- Financeiro (Entrega 2) ---------- */

export type Natureza = 'ENTRADA' | 'SAIDA';
export type TipoTransacao = 'RECEBER' | 'PAGAR' | 'AVULSO_ENTRADA' | 'AVULSO_SAIDA' | 'ESTORNO';

/** Direção do dinheiro de cada tipo (o estorno sempre inverte a do lançamento original). */
export const naturezaDe = (tipo: Exclude<TipoTransacao, 'ESTORNO'>): Natureza =>
  tipo === 'RECEBER' || tipo === 'AVULSO_ENTRADA' ? 'ENTRADA' : 'SAIDA';

/**
 * Valor que efetivamente entra ou sai da conta.
 * Entrada: RN02 (bruto − desconto + juros/multa − taxa).
 * Saída: a taxa bancária é custo nosso, então soma (bruto − desconto + juros/multa + taxa).
 */
export const valorEfetivo = (natureza: Natureza, bruto: number, desconto: number, jurosMulta: number, taxa: number) =>
  natureza === 'ENTRADA' ? valorLiquido(bruto, desconto, jurosMulta, taxa) : centavos(bruto - desconto + jurosMulta + taxa);

/** Soma `dias` dias úteis (pula sábado e domingo). D+0 devolve a própria data. */
export function somarDiasUteis(data: Date, dias: number) {
  const d = new Date(data);
  let falta = dias;
  while (falta > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) falta--;
  }
  return d;
}

/** "28 dias · boleto" → 28. Sem prazo reconhecível = à vista (0). */
export function prazoDias(condicoes?: string | null) {
  const m = condicoes?.match(/(\d+)\s*dias?/i);
  return m ? Number(m[1]) : 0;
}

export interface ContaLiquidez { _id: string; nomeBanco: string; saldoAtual: number; ativa: boolean }
export interface TransacaoLiquidez {
  natureza: Natureza; status: string; tipo: TipoTransacao; contaId?: string | null;
  valorBruto: number; valorLiquido?: number | null; dataVencimento?: Date | string | null; dataCompensacao?: Date | string | null;
}

const inicioDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const chaveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * RF16/RF17: liquidez D+1.
 * - Disponível hoje = saldo das contas − entradas liquidadas que ainda não compensaram.
 * - Fluxo dos próximos 7 dias: compensações + títulos a receber − títulos a pagar, dia a dia.
 * - Projeção D+1 = saldo acumulado no fim do próximo dia útil.
 */
export function calcularLiquidez(contas: ContaLiquidez[], transacoes: TransacaoLiquidez[], agora = new Date()) {
  const hoje = inicioDia(agora);
  const d1 = inicioDia(somarDiasUteis(agora, 1));
  const ativas = contas.filter((c) => c.ativa);
  const liquidadas = transacoes.filter((t) => t.status === 'LIQUIDADO' || t.status === 'CONCILIADO');
  const aCompensar = liquidadas.filter((t) => t.natureza === 'ENTRADA' && t.dataCompensacao && new Date(t.dataCompensacao) > agora);
  const pendentes = transacoes.filter((t) => t.status === 'PENDENTE' && t.dataVencimento);

  const porConta = ativas.map((c) => {
    const comp = centavos(aCompensar.filter((t) => String(t.contaId) === String(c._id)).reduce((s, t) => s + (t.valorLiquido ?? 0), 0));
    return { contaId: String(c._id), nomeBanco: c.nomeBanco, saldoAtual: centavos(c.saldoAtual), aCompensar: comp, disponivel: centavos(c.saldoAtual - comp) };
  });
  const disponivelHoje = centavos(porConta.reduce((s, c) => s + c.disponivel, 0));

  const vencidos = { receber: 0, pagar: 0 };
  for (const t of pendentes) {
    if (new Date(t.dataVencimento!) < hoje) vencidos[t.natureza === 'ENTRADA' ? 'receber' : 'pagar'] += t.valorBruto;
  }

  const dias: { data: string; entradas: number; saidas: number; saldo: number }[] = [];
  let saldo = disponivelHoje;
  let projecaoD1 = disponivelHoje;
  for (let i = 0; i < 7; i++) {
    const dia = new Date(hoje); dia.setDate(hoje.getDate() + i);
    const k = chaveDia(dia);
    const doDia = (d?: Date | string | null) => !!d && chaveDia(new Date(d)) === k;
    const entradas = centavos(
      aCompensar.filter((t) => doDia(t.dataCompensacao)).reduce((s, t) => s + (t.valorLiquido ?? 0), 0) +
      pendentes.filter((t) => t.natureza === 'ENTRADA' && doDia(t.dataVencimento)).reduce((s, t) => s + t.valorBruto, 0),
    );
    // Contas a pagar vencidas entram no primeiro dia: precisam sair do caixa.
    const saidas = centavos(pendentes.filter((t) => t.natureza === 'SAIDA' && (doDia(t.dataVencimento) || (i === 0 && new Date(t.dataVencimento!) < hoje)))
      .reduce((s, t) => s + t.valorBruto, 0));
    saldo = centavos(saldo + entradas - saidas);
    dias.push({ data: k, entradas, saidas, saldo });
    if (dia <= d1) projecaoD1 = saldo;
  }

  return {
    hoje: chaveDia(hoje), d1: chaveDia(d1), contas: porConta, disponivelHoje, projecaoD1,
    vencidos: { receber: centavos(vencidos.receber), pagar: centavos(vencidos.pagar) }, dias,
  };
}
