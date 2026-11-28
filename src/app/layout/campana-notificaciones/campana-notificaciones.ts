import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { interval, filter } from 'rxjs';
import Swal from 'sweetalert2';
import { NotificacionService, NotificacionDto, esNotificacionDeProyecto } from '../../core/services/notificacion';
import { TrackerService } from '../../core/services/tracker';
import { AuthService } from '../../core/auth/auth.service';

interface EstiloTipo { icono: string; color: string; }

const ESTILOS: Record<string, EstiloTipo> = {
  proy_alerta:     { icono: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', color: 'bg-red-100 text-red-600' },
  proy_asignado:   { icono: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'bg-blue-100 text-[#1e3a8a]' },
  proy_estado:     { icono: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'bg-amber-100 text-amber-700' },
  proy_bitacora:   { icono: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', color: 'bg-emerald-100 text-emerald-700' },
  asignacion:      { icono: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'bg-indigo-100 text-indigo-700' },
  estado_cambiado: { icono: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'bg-indigo-100 text-indigo-700' },
  eliminacion:     { icono: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', color: 'bg-slate-100 text-slate-500' }
};
const ESTILO_DEFECTO: EstiloTipo = { icono: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'bg-slate-100 text-slate-500' };

/**
 * Campana del encabezado: muestra las notificaciones del usuario (Tracker y Tareas),
 * las revisa cada minuto mientras la pestaña está visible y abre lo que corresponda al tocarlas.
 */
@Component({
  selector: 'app-campana-notificaciones',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './campana-notificaciones.html'
})
export class CampanaNotificacionesComponent {
  private notificacionService = inject(NotificacionService);
  private trackerService = inject(TrackerService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private host = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  readonly notificaciones = signal<NotificacionDto[]>([]);
  readonly abierta = signal(false);
  readonly cargando = signal(false);
  readonly noLeidas = computed(() => this.notificaciones().filter(n => !n.leida).length);
  readonly hayLeidas = computed(() => this.notificaciones().some(n => n.leida));

  constructor() {
    this.cargar();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef), filter(() => !document.hidden))
      .subscribe(() => this.cargar());
    const alVolver = () => { if (!document.hidden) this.cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', alVolver));
  }

  cargar() {
    if (!this.authService.usuarioActual()) return;
    this.cargando.set(true);
    this.notificacionService.getMisNotificaciones().subscribe(lista => {
      this.notificaciones.set(lista);
      this.cargando.set(false);
    });
  }

  alternar() {
    const abrir = !this.abierta();
    this.abierta.set(abrir);
    if (abrir) this.cargar();
  }

  /** Cierra el panel al tocar fuera de la campana. */
  @HostListener('document:click', ['$event'])
  fuera(e: MouseEvent) {
    if (this.abierta() && !this.host.nativeElement.contains(e.target as Node)) this.abierta.set(false);
  }

  @HostListener('document:keydown.escape')
  escape() { this.abierta.set(false); }

  estilo(n: NotificacionDto): EstiloTipo {
    return ESTILOS[n.tipo] ?? ESTILO_DEFECTO;
  }

  hace(fecha: string): string {
    // La API guarda en UTC; si la fecha llega sin zona se interpreta como UTC
    const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(fecha) ? fecha : fecha + 'Z').getTime();
    const min = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} días`;
  }

  abrir(n: NotificacionDto) {
    this.abierta.set(false);
    if (!n.leida) {
      this.notificaciones.update(l => l.map(x => x.id === n.id ? { ...x, leida: true } : x));
      this.notificacionService.marcarLeida(n.id).subscribe();
    }
    if (!n.entidadId) return;

    if (esNotificacionDeProyecto(n)) {
      const id = String(n.entidadId);
      this.trackerService.lineaDeProyecto(id).subscribe({
        next: p => {
          if (!p || p.archivado) {
            Swal.fire({ icon: 'info', title: 'Proyecto no disponible', text: 'El proyecto fue archivado o ya no está a tu cargo.', confirmButtonColor: '#1e3a8a' });
            return;
          }
          const linea = String(p.lineaNegocio).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          this.router.navigate(['/proyectos', linea], { queryParams: { proyecto: id } });
        },
        error: () => {}
      });
    } else if (n.tipo !== 'eliminacion') {
      this.router.navigate(['/tareas'], { queryParams: { tarea: String(n.entidadId) } });
    }
  }

  marcarTodas(e: Event) {
    e.stopPropagation();
    this.notificaciones.update(l => l.map(x => ({ ...x, leida: true })));
    this.notificacionService.marcarTodasLeidas().subscribe();
  }

  borrarLeidas(e: Event) {
    e.stopPropagation();
    this.notificaciones.update(l => l.filter(x => !x.leida));
    this.notificacionService.eliminarNotificacionesLeidas().subscribe();
  }
}
