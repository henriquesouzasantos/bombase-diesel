import { Component, computed, input } from '@angular/core';

const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  usuarios: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75',
  caminhao: 'M1 5h13v10H1zM14 9h4l4 4v2h-8zM5.5 18.5a2 2 0 1 0 0-.01M18.5 18.5a2 2 0 1 0 0-.01',
  pacote: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  chave: 'M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z',
  carteira: 'M3 7h18v12H3zM3 7l3-4h12l3 4M16 13h2',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  mais: 'M12 5v14M5 12h14',
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  alerta: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  check: 'M20 6L9 17l-5-5',
  menu: 'M3 6h18M3 12h18M3 18h18',
  fechar: 'M18 6L6 18M6 6l12 12',
  seta: 'M5 12h14M12 5l7 7-7 7',
  voltar: 'M19 12H5M12 19l-7-7 7-7',
  editar: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  banco: 'M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18M12 3l9 5H3z',
  lista: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  entrada: 'M12 19V5M5 12l7 7 7-7',
  saida: 'M12 5v14M5 12l7-7 7 7',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  cadeado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  calendario: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  desfazer: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 7',
  escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

@Component({
  selector: 'app-icon',
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="d()" /></svg>`,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent {
  name = input.required<string>();
  size = input(20);
  d = computed(() => PATHS[this.name()] ?? '');
}
