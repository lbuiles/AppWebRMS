import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../services/menu';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit {
  public menuService = inject(MenuService);
  public auth = inject(AuthService);
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

  // 1. Reemplazamos el array estático por una señal que almacenará los datos de la DB
  private modulosDesdeDB = signal<any[]>([]);

  ngOnInit() {

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
