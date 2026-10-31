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
