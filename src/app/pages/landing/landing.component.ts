import { AfterViewInit, Component, ElementRef, OnDestroy, ViewEncapsulation, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/toast.component';
import { iniciarScroll } from './landing-scroll';

/**
 * Página inicial com o raio-x do caminhão e animações guiadas pela rolagem.
 * O CSS usa encapsulamento "None", mas todo seletor começa com .lp para não vazar para o resto do app.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);
  private toast = inject(ToastService);
  private parar?: () => void;

  ngAfterViewInit() {
    this.parar = iniciarScroll(this.host.nativeElement, (m) => this.toast.ok(m));
  }

  ngOnDestroy() {
    this.parar?.();
  }
}
