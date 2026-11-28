import { Component, inject, computed, signal, effect, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../services/menu';
import { AuthService } from '../../core/auth/auth.service';
import { VersionService, fechaVersion } from '../../core/services/version';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  public menuService = inject(MenuService);
  public auth = inject(AuthService);
  public version = inject(VersionService);
  /** Detalle de la versión (fecha completa y commit), oculto por defecto */
  public verDetalleVersion = signal(false);
  public fechaVersion = fechaVersion;
  private router = inject(Router);

  constructor() {
    // En móvil/tablet el menú se cierra al navegar
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.menuService.close());
  }

  private urlActual = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url }
  );

  /**
   * Resalta el ítem principal solo cuando corresponde.
   * Los sub-ítems (Reportes de Tareas, Cuadrillas de Proyectos) tienen su propio resaltado,
   * así que el padre no debe quedar seleccionado a la vez.
   */
  itemActivo(ruta: string): boolean {
    const url = this.urlActual().split('?')[0].split('#')[0];
    if (ruta === '/tareas') return url === '/tareas';
    if (ruta === '/proyectos') return url.startsWith('/proyectos') && !url.startsWith('/proyectos/cuadrillas');
    return url === ruta || url.startsWith(ruta + '/');
  }

  // ── Submenús (colapsados por defecto) ──────────────────────────
  private static readonly SUBMENUS: Record<string, { ruta: string; nombre: string; permiso: string; icono: string }[]> = {
    '/proyectos': [{
      ruta: '/proyectos/cuadrillas', nombre: 'Cuadrillas', permiso: 'proyectos.cuadrillas.ver',
      icono: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    }],
    '/tareas': [{
      ruta: '/tareas/reportes', nombre: 'Reportes de cumplimiento', permiso: 'tareas.reportes',
      icono: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
    }]
  };

  /** Subítems visibles de un ítem según los permisos del usuario. */
  subitems(ruta: string) {
    return (SidebarComponent.SUBMENUS[ruta] ?? []).filter(s => this.auth.hasPermission(s.permiso));
  }

  /** Ítems con submenú abiertos. */
  private expandidos = signal<Set<string>>(new Set());

  estaExpandido(ruta: string): boolean {
    return this.expandidos().has(ruta);
  }

  alternarSubmenu(ruta: string, e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const s = new Set(this.expandidos());
    s.has(ruta) ? s.delete(ruta) : s.add(ruta);
    this.expandidos.set(s);
  }

  /** Al entrar a un subítem (p. ej. /proyectos/cuadrillas) su grupo se abre solo, para que se vea dónde se está. */
  private abrirGrupoActual = effect(() => {
    const url = this.urlActual().split('?')[0];
    for (const [padre, hijos] of Object.entries(SidebarComponent.SUBMENUS)) {
      if (hijos.some(h => url === h.ruta || url.startsWith(h.ruta + '/')) && !this.expandidos().has(padre)) {
        this.expandidos.set(new Set([...this.expandidos(), padre]));
      }
    }
  });

  // 1. Reemplazamos el array estático por una señal que almacenará los datos de la DB
  private modulosDesdeDB = signal<any[]>([]);

  ngOnInit() {
  this.version.cargarApi();

  this.menuService.getMenuConfig().subscribe({
    next: (data) => {
      this.modulosDesdeDB.set(data);
    },
    error: (err) => {

    }
  });
}

  // 3. Filtramos el menú usando la información real de la base de datos
  public menuItems = computed(() => {
    const usuario = this.auth.usuarioActual();
    const modulos = this.modulosDesdeDB();

    // Si no hay usuario o aún no cargan los módulos, menú vacío
    if (!usuario || modulos.length === 0) return [];

    // Filtramos los módulos de la DB según el permisoRaiz (slugRaiz en el backend)
  return modulos
    .filter(m => this.auth.hasModule(m.slugRaiz) && !m.slugRaiz.includes('.'))
    .sort((a, b) => a.orden - b.orden);
    });
}
