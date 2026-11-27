import { CanDeactivateFn } from '@angular/router';
import Swal from 'sweetalert2';

/** Pantallas que pueden tener formularios con cambios sin guardar. */
export interface ConCambiosPendientes {
  tieneCambiosSinGuardar(): boolean;
}

/** Confirmación común: true = el usuario acepta descartar los cambios. */
export async function confirmarDescartarCambios(): Promise<boolean> {
  const r = await Swal.fire({
    icon: 'warning',
    title: 'Cambios sin guardar',
    text: 'Tienes cambios que no se han guardado. ¿Quieres descartarlos?',
    showCancelButton: true,
    confirmButtonText: 'Descartar cambios',
    cancelButtonText: 'Seguir editando',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#1e3a8a',
    reverseButtons: true,
    focusCancel: true
  });
  return r.isConfirmed;
}

/** Pregunta antes de salir de la pantalla por el menú si hay cambios sin guardar. */
export const cambiosPendientesGuard: CanDeactivateFn<ConCambiosPendientes> = (componente) =>
  !componente?.tieneCambiosSinGuardar?.() || confirmarDescartarCambios();
