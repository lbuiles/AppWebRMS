import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * NIVEL 1: Autenticación
 * Si no hay sesión iniciada, manda al login.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.usuarioActual()) return true;

  console.warn('Bloqueado por AuthGuard: No hay sesión activa.');
  router.navigate(['/login']);
  return false;
};

/**
 * NIVEL 2: Permisos Granulares (Reemplaza al RolGuard)
 * Verifica si el usuario tiene el permiso específico requerido para la ruta.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const permisoRequerido = route.data['permiso'] as string;

  // 1. Si la ruta no tiene restricción, pasa directo
  if (!permisoRequerido) return true;

  // 2. Obtenemos el usuario del Signal
  const usuario = authService.usuarioActual();

  // 3. Si no hay usuario en absoluto (no ha hecho login), al login
  if (!usuario) {
    router.navigate(['/login']);
    return false;
  }

  // 4. VERIFICACIÓN CRÍTICA:
  // Si el array de permisos está vacío, puede que aún se esté cargando.
  // Pero si ya cargó y no tiene el permiso, bloqueamos.
  if (authService.hasPermission(permisoRequerido)) {
    return true;
  }

  // Debug: Esto te dirá en la consola qué permisos tienes realmente en ese momento
  console.error(`Acceso denegado a [${permisoRequerido}]. Tus permisos son:`, usuario.permisos);

  router.navigate(['/panel']);
  return false;
};

/**
 * NIVEL 0: Rutas Públicas
 * Evita que un usuario ya logueado vuelva al Login.
 */
export const publicGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.usuarioActual()) return true;

  router.navigate(['/panel']);
  return false;
};
