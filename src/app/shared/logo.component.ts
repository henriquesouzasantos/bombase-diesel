import { Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <span class="flex items-center gap-2.5" [class.text-white]="claro()" [class.text-brand]="!claro()">
      <span class="flex flex-col gap-[3px]" aria-hidden="true">
        <i class="block h-1 w-[22px] -skew-x-[24deg] bg-bomb-red"></i>
        <i class="ml-1 block h-1 w-4 -skew-x-[24deg] bg-bomb-red"></i>
        <i class="ml-2 block h-1 w-2.5 -skew-x-[24deg] bg-bomb-red"></i>
      </span>
      <span class="flex flex-col leading-[.8]">
        <span class="font-display text-[28px] font-extrabold italic">BOMBASE</span>
        <span class="pl-0.5 font-display text-[11px] font-bold italic tracking-[.42em] text-bomb-red">DIESEL</span>
      </span>
    </span>
  `,
})
export class LogoComponent {
  claro = input(false);
}
