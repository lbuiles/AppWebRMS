import { ApplicationRef, Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Router, NavigationError } from '@angular/router';
import { filter, first } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Avisa cuando hay una versión nueva publicada y la aplica al recargar.
 * - Revisa al abrir la app, cada 30 minutos y cuando la pestaña vuelve a estar visible.
 * - Si una pantalla falla al cargar porque se publicó una versión nueva (archivos viejos que ya
 *   no existen en el servidor), recarga esa misma dirección.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionService {
  private swUpdate = inject(SwUpdate);
  private appRef = inject(ApplicationRef);
  private router = inject(Router);
  private avisando = false;

  iniciar() {
    this.recargarSiFaltaUnaPantalla();
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.avisarNuevaVersion());

    // Estado irrecuperable (caché del navegador dañada): la única salida es recargar
    this.swUpdate.unrecoverable.subscribe(() => {
      Swal.fire({
        icon: 'warning', title: 'Hay que recargar la aplicación',
        text: 'Ocurrió un problema con los archivos guardados en este dispositivo. Se recargará la página.',
        confirmButtonText: 'Recargar', confirmButtonColor: '#1e3a8a', allowOutsideClick: false
      }).then(() => document.location.reload());
    });

    const revisar = () => this.swUpdate.checkForUpdate().catch(() => {});
    this.appRef.isStable.pipe(first(estable => estable)).subscribe(() => {
      revisar();
      setInterval(revisar, 30 * 60 * 1000);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisar();
    });
  }

  private async avisarNuevaVersion() {
    if (this.avisando) return;
    this.avisando = true;
    const r = await Swal.fire({
      toast: true, position: 'bottom-end', icon: 'info',
      title: 'Hay una nueva versión del ERP',
      text: 'Actualiza para usar los últimos cambios. Guarda antes lo que estés editando.',
      showConfirmButton: true, confirmButtonText: 'Actualizar ahora', confirmButtonColor: '#1e3a8a',
      showCancelButton: true, cancelButtonText: 'Más tarde'
    });
    this.avisando = false;
    if (r.isConfirmed) {
      await this.swUpdate.activateUpdate().catch(() => {});
      document.location.reload();
    }
  }

  private recargarSiFaltaUnaPantalla() {
    this.router.events
      .pipe(filter((e): e is NavigationError => e instanceof NavigationError))
      .subscribe(e => {
        const msg = String(e.error?.message ?? e.error ?? '');
        if (/dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/i.test(msg)) {
          // Evita un ciclo de recargas si el problema persiste
          const clave = 'rms_recarga_pantalla';
          if (sessionStorage.getItem(clave) === e.url) return;
          sessionStorage.setItem(clave, e.url);
          document.location.assign(e.url);
        }
      });
  }
}
