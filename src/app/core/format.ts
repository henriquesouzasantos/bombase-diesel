const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');
const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export const fmtBRL = (v: number | null | undefined) => brl.format(v ?? 0);
export const fmtNum = (v: number | null | undefined) => num.format(v ?? 0);
export const fmtData = (iso?: string) => (iso ? dt.format(new Date(iso)) : '—');

/** "2026-11-09" (input date) → ISO ao meio-dia local, para o fuso não trocar o dia. */
export const isoMeioDia = (yyyyMmDd: string) => new Date(yyyyMmDd + 'T12:00:00').toISOString();
/** Data local de hoje (ou deslocada) no formato do input date. */
export function diaInput(deslocDias = 0, base = new Date()) {
  const d = new Date(base); d.setDate(d.getDate() + deslocDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dtCurta = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
/** "2026-11-10" → "ter., 10/11" */
export const fmtDiaCurto = (yyyyMmDd: string) => dtCurta.format(new Date(yyyyMmDd + 'T12:00:00'));
