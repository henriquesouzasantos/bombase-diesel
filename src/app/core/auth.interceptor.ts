import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Anexa o token do Firebase em toda chamada à API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  const auth = inject(AuthService);
  return from(auth.token()).pipe(
    switchMap((t) => next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req)),
  );
};
