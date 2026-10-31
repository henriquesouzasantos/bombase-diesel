/**
 * Motor das animações guiadas pela rolagem da página inicial.
 * Cada seção com [data-pin] recebe um progresso de 0 a 1 enquanto está "presa" na tela,
 * e a função correspondente em HANDLERS desenha o estado daquele instante.
 * Retorna uma função de limpeza (chamada no ngOnDestroy).
 */
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function iniciarScroll(root: HTMLElement, avisar: (msg: string) => void): () => void {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll(s)) as unknown as T[];
  const hdr = $('#hdr');

  /* ---------- raio-x ---------- */
  const PARTS: [number, number][] = [[303, 138], [200, 274], [258, 196], [418, 251], [930, 350]];
  const cam = $<SVGGElement>('#cam');
  const clipX = $<SVGRectElement>('#clipXr');
  const clipE = $<SVGRectElement>('#clipEr');
  const beam = $<SVGGElement>('#beam');
  const hots = $<SVGGElement>('#hots');
  const hotEls = $$<SVGGElement>('.hot');
  const partEls = $$('#parts li');
  const svgTruck = $<SVGSVGElement>('.xr-svg');
  let lastActive: number | null = null;

  function setActive(i: number) {
    if (i === lastActive) return;
    lastActive = i;
    hotEls.forEach((h, k) => h.classList.toggle('on', k === i));
    partEls.forEach((li, k) => li.classList.toggle('on', k === i));
    if (i >= 0) {
      const [x, y] = PARTS[i];
      const s = i === 4 ? 1.9 : 2.3;
      cam.style.transform = `translate(${600 - s * x}px,${220 - s * y}px) scale(${s})`;
      const li = partEls[i];
      const box = li.parentElement!;
      if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: li.offsetLeft - box.offsetLeft, behavior: RM ? 'auto' : 'smooth' });
    } else cam.style.transform = 'none';
  }

  function xray(p: number) {
    const scan = clamp((p - 0.06) / 0.38);
    const X = scan * 1200;
    clipX.setAttribute('width', String(X));
    clipE.setAttribute('x', String(X));
    clipE.setAttribute('width', String(1200 - X));
    beam.setAttribute('transform', `translate(${X} 0)`);
    beam.setAttribute('opacity', scan > 0 && scan < 1 ? '1' : '0');
    $('#scanPct').textContent = Math.round(scan * 100) + '%';
    const fade = clamp((p - 0.01) / 0.08);
    $('#xrTitle').style.opacity = String(1 - fade);
    $('#xrTitle').style.transform = `translateY(${-40 * fade}px)`;
    svgTruck.style.opacity = String(0.28 + 0.72 * fade);
    $('#parts').style.opacity = String(clamp((p - 0.05) / 0.08));
    $('.hud').style.opacity = String(fade);
    hots.classList.toggle('show', scan >= 1);
    let a = -1;
    if (p >= 0.47 && p < 0.9) a = Math.min(4, Math.floor((p - 0.47) / 0.086));
    setActive(a);
    $('#outro').style.opacity = String(clamp((p - 0.9) / 0.06));
  }

  /* ---------- trilho horizontal de telas ---------- */
  const track = $('#track');
  const railCount = $('#railCount');
  function rail(p: number) {
    const max = Math.max(0, track.scrollWidth - innerWidth);
    track.style.transform = `translateX(${-max * p}px)`;
    const n = Math.min(6, Math.floor(p * 5.999) + 1);
    railCount.innerHTML = `<b>${String(n).padStart(2, '0')}</b> / 06`;
  }

  /* ---------- ciclo da OS ---------- */
  const stops = $$('.stop');
  const card = $('#osCard');
  const lane = $('#lane');
  const ST = ['Aberto', 'Em andamento', 'Aguardando peças', 'Qualidade', 'Concluído', 'Faturado'];
  const RULE = [['info', 'Aguardando técnico'], ['info', 'J. Pereira · 4,0 h apontadas'], ['warn', 'BI-0445 requisitado ao estoque'], ['info', 'Bancada: vazão e estanqueidade'], ['ok', 'RN01: todas as peças com baixa física'], ['ok', 'Título R$ 6.200,00 · NF-e emitida']];
  let lastSt = -1;
  function os(p: number) {
    const f = p * 5;
    const i = Math.min(5, Math.round(f));
    const vertical = matchMedia('(max-width:760px)').matches;
    const pos = stops.map((s) => (vertical ? s.offsetTop : s.offsetLeft));
    const a = Math.floor(f), b = Math.min(5, a + 1), t = f - a;
    const v = pos[a] + (pos[b] - pos[a]) * t;
    card.style.transform = vertical ? 'none' : `translateX(${Math.min(v, lane.clientWidth - card.offsetWidth)}px)`;
    stops.forEach((s, k) => { s.classList.toggle('done', k < i); s.classList.toggle('on', k === i); });
    if (i !== lastSt) {
      lastSt = i;
      $('#osStatus').textContent = ST[i];
      $('#osRule').innerHTML = `<span class="lp-pill ${RULE[i][0]}">${RULE[i][1]}</span>`;
      card.style.borderLeftColor = i >= 4 ? 'var(--ok)' : 'var(--red)';
    }
  }

  /* ---------- RN02 ---------- */
  const terms = $$('.term');
  const liq = $('#liq');
  function eq(p: number) {
    const k = p * 6;
    terms.forEach((t, i) => t.classList.toggle('on', k >= i * 0.9));
    const r = clamp((k - 3.6) / 1.6);
    liq.textContent = brl(Math.round(6175.19 * r * 100) / 100);
  }

  /* ---------- liquidez D+1 (dados de exemplo) ---------- */
  const DAYS = ['02/11', '03/11', '04/11', '05/11', '06/11', '09/11', '10/11'];
  const IN = [22400, 7104.4, 4970.55, 18200, 12640, 9810, 15300];
  const OUT = [10295.8, 11333.65, 3890, 14120, 6200, 13540, 8016];
  const S0 = 248915.42;
  const svg = $<SVGSVGElement>('#chart');
  const NS = 'http://www.w3.org/2000/svg';
  const W = 760, H = 300, L = 56, R = 12, T = 14, B = 36, MAX = 25000;
  const el = (n: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(NS, n) as SVGElement;
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    svg.appendChild(e);
    return e;
  };
  const y = (v: number) => T + (H - T - B) * (1 - v / MAX);
  svg.replaceChildren();
  for (let v = 0; v <= MAX; v += 5000) {
    el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' });
    el('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }).textContent = v === 0 ? '0' : v / 1000 + ' mil';
  }
  const gw = (W - L - R) / 7, bw = Math.min(26, gw * 0.3);
  const bars: [SVGElement, SVGElement][] = [];
  const labs: SVGElement[] = [];
  DAYS.forEach((d, i) => {
    const cx = L + gw * i + gw / 2;
    const b1 = el('rect', { x: cx - bw - 2, y: y(IN[i]), width: bw, height: y(0) - y(IN[i]), rx: 3, class: 'b bin' });
    const b2 = el('rect', { x: cx + 2, y: y(OUT[i]), width: bw, height: y(0) - y(OUT[i]), rx: 3, class: 'b bout' });
    const t = el('text', { x: cx, y: H - 12, 'text-anchor': 'middle', class: 'daylab' });
    t.textContent = d;
    const ti = document.createElementNS(NS, 'title');
    ti.textContent = `${d}: entradas ${brl(IN[i])}, saídas ${brl(OUT[i])}`;
    b1.appendChild(ti);
    bars.push([b1, b2]);
    labs.push(t);
  });
  el('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: 'currentColor', 'stroke-width': 1, style: 'color:var(--muted)' });
  function liqF(p: number) {
    const f = p * 7.2;
    let last = 0;
    bars.forEach(([b1, b2], i) => {
      const g = clamp(f - i);
      b1.style.transform = `scaleY(${g})`;
      b2.style.transform = `scaleY(${clamp(f - i - 0.15)})`;
      if (g > 0) last = i;
    });
    labs.forEach((t, i) => t.classList.toggle('on', i === last));
    let s = S0;
    for (let i = 0; i <= last; i++) s += IN[i] - OUT[i];
    $('#saldoV').textContent = brl(s);
    $('#saldoLab').textContent = `Saldo projetado em ${DAYS[last]}`;
  }

  /* ---------- motor ---------- */
  const HANDLERS: Record<string, (p: number) => void> = { xray, rail, os, eq, liq: liqF };
  const pins = $$('[data-pin]');
  const prog = (e: HTMLElement) => {
    const r = e.getBoundingClientRect();
    const h = e.offsetHeight - innerHeight;
    return h > 0 ? clamp(-r.top / h) : 1;
  };
  const xraySec = $('#xray');
  const progress = $('#progress');
  const nativo = CSS.supports('animation-timeline', 'scroll()');
  function frame() {
    if (RM) { xray(0.45); rail(0); os(1); eq(1); liqF(1); }
    else pins.forEach((e) => HANDLERS[e.dataset['pin']!]?.(prog(e)));
    hdr.classList.toggle('dark', xraySec.getBoundingClientRect().bottom > 64);
    const sh = document.documentElement.scrollHeight - innerHeight;
    if (!nativo) progress.style.setProperty('--scroll', String(sh > 0 ? scrollY / sh : 0));
  }
  let raf = 0;
  const req = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; frame(); }); };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  frame();
  if (RM) { hots.classList.add('show'); partEls.forEach((li) => li.classList.add('on')); }
  document.fonts?.ready.then(req);

  /* clicar num ponto do caminhão rola até aquela peça */
  const onHot = (ev: Event) => {
    const i = Number((ev.currentTarget as SVGGElement).dataset['i']);
    const p = 0.47 + 0.086 * i + 0.04;
    scrollTo({ top: xraySec.offsetTop + p * (xraySec.offsetHeight - innerHeight), behavior: RM ? 'auto' : 'smooth' });
  };
  hotEls.forEach((h) => h.addEventListener('click', onHot));

  const onToast = (ev: Event) => avisar((ev.currentTarget as HTMLElement).dataset['toast'] ?? '');
  const toastBtns = $$('[data-toast]');
  toastBtns.forEach((b) => b.addEventListener('click', onToast));

  return () => {
    removeEventListener('scroll', req);
    removeEventListener('resize', req);
    cancelAnimationFrame(raf);
    hotEls.forEach((h) => h.removeEventListener('click', onHot));
    toastBtns.forEach((b) => b.removeEventListener('click', onToast));
  };
}
