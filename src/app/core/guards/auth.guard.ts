import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

// 1. EL PORTERO DEL PANEL (Solo deja entrar si tienes el token de Google)
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('rms_token');

  if (token) {
    return true; // Tienes la llave, pasa adelante
  } else {
    router.navigate(['/login']); // No tienes llave, devuélvete al login
    return false;
  }
};

// 2. EL PORTERO DEL LOGIN (Si ya estás logueado, te manda directo al panel)
export const publicGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('rms_token');

  if (token) {
    router.navigate(['/panel']); // Ya iniciaste sesión, no tienes nada que hacer en el login
    return false;
  } else {
    return true; // No estás logueado, puedes ver la pantalla
  }
};
