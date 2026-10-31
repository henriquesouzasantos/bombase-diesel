const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');
const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export const fmtBRL = (v: number | null | undefined) => brl.format(v ?? 0);
export const fmtNum = (v: number | null | undefined) => num.format(v ?? 0);
export const fmtData = (iso?: string) => (iso ? dt.format(new Date(iso)) : '—');
